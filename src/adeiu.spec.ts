import { constants } from 'node:os'

import Emittery from 'emittery'
import pWaitFor from 'p-wait-for'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import type adeiuType from './adeiu'

describe('adeiu', () => {
  const emitter = new Emittery()

  let adeiu: typeof adeiuType

  const exitSpy = vi.spyOn(process, 'exit')
  const killSpy = vi.spyOn(process, 'kill')
  const removeListenerSpy = vi.spyOn(process, 'removeListener')
  const prependListenerSpy = vi.spyOn(process, 'prependListener')
  const stdErrWriteSpy = vi.spyOn(process.stderr, 'write')
  let isTTY = true

  // Because we're mocking `process`, we need to do so just before our tests. As
  // such, we also need to import the module being tested _after_ these mocks
  // have been set up to ensure the module gets the mocked version.
  beforeEach(async () => {
    emitter.clearListeners()

    exitSpy.mockImplementation(() => undefined as never)
    killSpy.mockImplementation(() => true as const)
    stdErrWriteSpy.mockImplementation(() => true)

    // Mock process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      get: () => isTTY,
      configurable: true
    })

    vi.stubEnv('NO_COLOR', '')
    vi.stubEnv('FORCE_COLOR', '')

    prependListenerSpy.mockImplementation((eventName: string, listener: any) => {
      void emitter.once(eventName).then(() => listener(eventName)) // tslint:disable-line no-floating-promises
      return process
    })

    adeiu = (await import('./adeiu')).default
  })

  describe('common case', () => {
    let unregister: any

    beforeEach(() => {
      unregister = adeiu(() => {
        // Empty block.
      })
    })

    it('should bind to termination events', () => {
      const signals = new Set(prependListenerSpy.mock.calls.map((args: Array<any>) => args[0]))

      expect(signals.has('SIGINT')).toBe(true)
      expect(signals.has('SIGQUIT')).toBe(true)
      expect(signals.has('SIGTERM')).toBe(true)
      expect(signals.has('SIGUSR2')).toBe(true)
    })

    it('should call process.kill with the signal it received', async () => {
      const SIGNAL = 'SIGINT'
      await emitter.emit(SIGNAL)
      await pWaitFor(() => killSpy.mock.calls.length > 0)
      expect(killSpy.mock.calls[0][1]).toBe(SIGNAL)
    })

    it('should unregister handlers when the last callback is unregistered', () => {
      unregister()
      expect(removeListenerSpy).toHaveBeenCalledTimes(4)
    })

    afterEach(() => {
      unregister()
    })
  })

  describe('registering with custom signals', () => {
    const signal = 'SIGFOO' as NodeJS.Signals
    const callback = vi.fn()
    const otherCallback = vi.fn()

    it('should install the adeiu handler when the first user callback is registered', () => {
      expect(prependListenerSpy).not.toHaveBeenCalled()

      // Register the first callback for this signal.
      adeiu(callback, {signals: [signal]})

      // Assert that we installed the handler.
      expect(prependListenerSpy.mock.calls[0][0]).toBe(signal)

      // Register another callback on the same signal.
      adeiu(otherCallback, {signals: [signal]})

      // Assert that we did not call process.once again.
      expect(prependListenerSpy).toHaveBeenCalledTimes(1)
    })

    it('should uninstall the adeiu handler when the last user callback is unregistered', () => {
      expect(removeListenerSpy).not.toHaveBeenCalled()

      // Register both callbacks this signal.
      const unregister = adeiu(callback, {signals: [signal]})
      const unregisterOther = adeiu(otherCallback, {signals: [signal]})

      // Unregister the first callback.
      unregister()

      // Assert that we didn't uninstall the handler.
      expect(removeListenerSpy).not.toHaveBeenCalled()

      // Uninstall the second handler.
      unregisterOther()

      // Assert that we uninstalled the handler for the signal.
      expect(removeListenerSpy.mock.calls[0][0]).toBe(signal)
    })
  })

  describe('when a callback rejects/throws', () => {
    let unregister: any

    const err = new Error('Handler threw.')

    beforeEach(() => {
      vi.stubEnv('NO_COLOR', '1')
    })

    describe('and the callback has a `name` property', () => {
      const badHandler = () => {
        throw err
      }

      beforeEach(async () => {
        unregister = adeiu(badHandler)
        await emitter.emit('SIGINT')
      })

      it('should call process.exit', () => {
        expect(exitSpy).toHaveBeenCalled()
      })

      it.skip('should log errors to stderr', () => {
        const output = stdErrWriteSpy.mock.calls[0][0]
        expect(output).toMatch(/Encountered the following errors while responding to SIGINT:[\s\S]*• Handler threw\. \(via handler: badHandler\)/)
      })
    })

    describe('and the callback does not have a `name` property', () => {
      beforeEach(async () => {
        unregister = adeiu(() => {
          throw err
        })

        await emitter.emit('SIGINT')
      })

      it.skip('should indicate an anonymous function', () => {
        const output = stdErrWriteSpy.mock.calls[0][0]
        expect(output).toMatch(/Encountered the following errors while responding to SIGINT:[\s\S]*• Handler threw\. \(via handler: anonymous\)/)
      })
    })

    afterEach(() => {
      unregister()
    })
  })

  describe('options validation', () => {
    it('should throw for invalid signal names', () => {
      expect(() => adeiu(() => void 0, { signals: ['INVALID' as NodeJS.Signals] }))
        .toThrow('Invalid signal: INVALID')
    })

    it('should throw for non-string signals', () => {
      expect(() => adeiu(() => void 0, { signals: [123 as any] }))
        .toThrow('Expected signal to be of type "string"')
    })

    it('should throw for invalid timeout type', () => {
      expect(() => adeiu(() => void 0, { timeout: '1000' as any }))
        .toThrow('Expected type of "timeout" to be "number" or "undefined"')
    })
  })

  describe('timeout handling', () => {
    beforeEach(() => {
      vi.stubEnv('NO_COLOR', '1')
    })

    it('should handle successful completion within timeout', async () => {
      const handler = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)))
      const unregister = adeiu(handler, { timeout: 100 })
      await emitter.emit('SIGINT')
      await pWaitFor(() => handler.mock.calls.length > 0)

      expect(handler).toHaveBeenCalledWith('SIGINT')
      expect(exitSpy).not.toHaveBeenCalled()

      unregister()
    })

    it.skip('should handle timeout and log error', async () => {
      const handler = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)))
      const unregister = adeiu(handler, { timeout: 100 })

      await emitter.emit('SIGINT')
      await pWaitFor(() => stdErrWriteSpy.mock.calls.length > 0)

      expect(handler).toHaveBeenCalledWith('SIGINT')
      const output = stdErrWriteSpy.mock.calls[0][0]
      expect(output).toMatch(/Encountered the following errors while responding to SIGINT:[\s\S]*• Operation timed-out after 100ms\. \(via handler: anonymous\)/)
      expect(exitSpy).toHaveBeenCalledWith(130) // 128 + SIGINT(2)

      unregister()
    })
  })

  describe('signal exit codes', () => {
    it('should exit with correct signal code', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })
      const unregister = adeiu(handler)

      await emitter.emit('SIGTERM')
      await pWaitFor(() => exitSpy.mock.calls.length > 0)

      expect(exitSpy).toHaveBeenCalledWith(128 + constants.signals.SIGTERM)

      unregister()
    })

    it('should exit with code 1 for unknown signals', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })
      const unregister = adeiu(handler, { signals: ['SIGFOO' as NodeJS.Signals] })

      await emitter.emit('SIGFOO')
      await pWaitFor(() => exitSpy.mock.calls.length > 0)

      expect(exitSpy).toHaveBeenCalledWith(1)

      unregister()
    })
  })

  describe('error logging with color support', () => {
    const handler = () => {
      throw new Error('Test error')
    }

    it('should use colors when TTY supports it', async () => {
      isTTY = true
      vi.stubEnv('NO_COLOR', '')
      vi.stubEnv('FORCE_COLOR', '')

      const unregister = adeiu(handler)
      await emitter.emit('SIGINT')

      expect(stdErrWriteSpy.mock.calls[0][0]).toMatch('\u001B[31m')

      unregister()
    })

    it('should not use colors when NO_COLOR is set', async () => {
      isTTY = true
      vi.stubEnv('NO_COLOR', '1')
      vi.stubEnv('FORCE_COLOR', '')

      const unregister = adeiu(handler)
      await emitter.emit('SIGINT')

      expect(stdErrWriteSpy.mock.calls[0][0]).not.toMatch('\u001B[31m')

      unregister()
    })

    it('should use colors when FORCE_COLOR is set', async () => {
      isTTY = false
      vi.stubEnv('NO_COLOR', '')
      vi.stubEnv('FORCE_COLOR', '1')

      const unregister = adeiu(handler)
      await emitter.emit('SIGINT')

      expect(stdErrWriteSpy.mock.calls[0][0]).toMatch('\u001B[31m')

      unregister()
    })
  })

  describe('concurrent handler execution', () => {
    it('should execute multiple handlers concurrently', async () => {
      const start = Date.now()
      const delay = 100

      const handler1 = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, delay)))
      const handler2 = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, delay)))

      const unregister1 = adeiu(handler1)
      const unregister2 = adeiu(handler2)

      await emitter.emit('SIGINT')
      await pWaitFor(() => handler1.mock.calls.length > 0 && handler2.mock.calls.length > 0)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(delay * 2) // Should take ~delay ms, not delay*2 ms

      unregister1()
      unregister2()
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    vi.unstubAllEnvs()
  })
})