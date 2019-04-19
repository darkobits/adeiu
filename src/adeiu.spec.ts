import Emittery from 'emittery';
import pWaitFor from 'p-wait-for';


describe('adeiu', () => {
  let adeiu: Function;
  let emitter: Emittery;
  let exitSpy: any;
  let killSpy: any;
  let offSpy: any;
  let onceSpy: any;
  let stdErrWriteSpy: any;


  beforeEach(() => {
    emitter = new Emittery();

    exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      return undefined as never;
    });

    killSpy = jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      return;
    });

    offSpy = jest.spyOn(process, 'off');

    onceSpy = jest.spyOn(process, 'once').mockImplementation((eventName: string, listener: Function) => {
      emitter.once(eventName).then(() => listener(eventName)); // tslint:disable-line no-floating-promises
      return process;
    });

    stdErrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation(data => {
      return true;
    });

    adeiu = require('./adeiu').default; // tslint:disable-line no-require-imports
  });

  describe('common case', () => {
    let unregister: Function;

    beforeEach(() => {
      unregister = adeiu(() => {
        // Empty block.
      });
    });

    it('should bind to termination events', () => {
      const signals = onceSpy.mock.calls.map((args: Array<any>) => args[0]);

      expect(signals.includes('SIGINT')).toBe(true);
      expect(signals.includes('SIGQUIT')).toBe(true);
      expect(signals.includes('SIGTERM')).toBe(true);
      expect(signals.includes('SIGUSR2')).toBe(true);
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

  describe('when a callback rejects/throws', () => {
    let unregister: Function;

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
  });
});
