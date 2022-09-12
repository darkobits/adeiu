import Emittery from 'emittery';
import pWaitFor from 'p-wait-for';

import type adeiuType from './adeiu';


describe('adeiu', () => {
  const emitter = new Emittery();

  let adeiu: typeof adeiuType;

  const exitSpy = jest.spyOn(process, 'exit');
  const killSpy = jest.spyOn(process, 'kill');
  const offSpy = jest.spyOn(process, 'off');
  const prependOnceSpy = jest.spyOn(process, 'prependOnceListener');
  const stdErrWriteSpy = jest.spyOn(process.stderr, 'write');

  // Because we're mocking `process`, we need to do so just before our tests. As
  // such, we also need to import the module being tested _after_ these mocks
  // have been set up to ensure the module gets the mocked version.
  beforeEach(() => {
    emitter.clearListeners();

    exitSpy.mockImplementation(() => undefined as never);
    killSpy.mockImplementation(() => true);
    stdErrWriteSpy.mockImplementation(() => true);

    prependOnceSpy.mockImplementation((eventName: string, listener: any) => {
      void emitter.once(eventName).then(() => listener(eventName)); // tslint:disable-line no-floating-promises
      return process;
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    adeiu = require('./adeiu').default;
  });

  describe('common case', () => {
    let unregister: any;

    beforeEach(() => {
      unregister = adeiu(() => {
        // Empty block.
      });
    });

    it('should bind to termination events', () => {
      const signals = new Set(prependOnceSpy.mock.calls.map((args: Array<any>) => args[0]));

      expect(signals.has('SIGINT')).toBe(true);
      expect(signals.has('SIGQUIT')).toBe(true);
      expect(signals.has('SIGTERM')).toBe(true);
      expect(signals.has('SIGUSR2')).toBe(true);
    });

    it('should call process.kill with the signal it received', async () => {
      const SIGNAL = 'SIGINT';
      await emitter.emit(SIGNAL);
      await pWaitFor(() => killSpy.mock.calls.length > 0);
      expect(killSpy.mock.calls[0][1]).toBe(SIGNAL);
    });

    it('should unregister handlers when the last callback is unregistered', () => {
      unregister();
      expect(offSpy).toHaveBeenCalledTimes(4);
    });

    afterEach(() => {
      unregister();
    });
  });

  describe('registering with custom signals', () => {
    const signal = 'SIGFOO' as NodeJS.Signals;
    const callback = jest.fn();
    const otherCallback = jest.fn();


    it('should install the adeiu handler when the first user callback is registered', () => {
      expect(prependOnceSpy).not.toHaveBeenCalled();

      // Register the first callback for this signal.
      adeiu(callback, {signals: [signal]});

      // Assert that we installed the handler.
      expect(prependOnceSpy.mock.calls[0][0]).toBe(signal);

      // Register another callback on the same signal.
      adeiu(otherCallback, {signals: [signal]});

      // Assert that we did not call process.once again.
      expect(prependOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('should uninstall the adeiu handler when the last user callback is unregistered', () => {
      expect(offSpy).not.toHaveBeenCalled();

      // Register both callbacks this signal.
      const unregister = adeiu(callback, {signals: [signal]});
      const unregisterOther = adeiu(otherCallback, {signals: [signal]});

      // Unregister the first callback.
      unregister();

      // Assert that we didn't uninstall the handler.
      expect(offSpy).not.toHaveBeenCalled();

      // Uninstall the second handler.
      unregisterOther();

      // Assert that we uninstalled the handler for the signal.
      expect(offSpy.mock.calls[0][0]).toBe(signal);
    });
  });

  describe('when a callback rejects/throws', () => {
    let unregister: any;

    const err = new Error('Handler threw.');

    describe('and the callback has a `name` property', () => {
      const badHandler = () => {
        throw err;
      };

      beforeEach(async () => {
        unregister = adeiu(badHandler);
        await emitter.emit('SIGINT');
      });

      it('should call process.exit', () => {
        expect(exitSpy).toHaveBeenCalled();
      });

      it('should log errors to stderr', () => {
        expect(stdErrWriteSpy.mock.calls[0][0]).toMatch(err.message);
      });

      it('should include the functions name', () => {
        expect(stdErrWriteSpy.mock.calls[0][0]).toMatch('badHandler');
      });
    });

    describe('and the callback does not have a `name` property', () => {
      beforeEach(async () => {
        unregister = adeiu(() => {
          throw err;
        });

        await emitter.emit('SIGINT');
      });

      it('should indicate an anonymous function', () => {
        expect(stdErrWriteSpy.mock.calls[0][0]).toMatch('Anonymous');
      });
    });


    afterEach(() => {
      unregister();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });
});
