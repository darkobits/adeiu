import { constants } from 'node:os'

export type AdeiuHandler = (signal: NodeJS.Signals) => void | Promise<void>;

export interface AdeiuOptions {
  /**
   * (Optional) Array of signals that the provided handler should be invoked
   * for. These signals are _not_ merged with the defaults, so each desired
   * signal must be explicitly enumerated.
   */
  signals?: Array<NodeJS.Signals>
  /**
   * Maximum amount of time (in milliseconds) that the handler may run for
   * before it will be canceled. If this option is omitted or undefined, no
   * timeout will be enforced.
   */
  timeout?: number | undefined
}

export const DEFAULT_SIGNALS: Array<NodeJS.Signals> = [
  'SIGINT',
  'SIGQUIT',
  'SIGTERM',
  // Signal sent by nodemon to child processes when it needs to restart them.
  'SIGUSR2'
] as const

/**
 * Tracks which signals we have registered process listeners for, and which user
 * handlers should be invoked for each signal.
 */
const signalHandlers = new Map<NodeJS.Signals, Map<AdeiuHandler, AdeiuOptions>>()

/**
 * Tracks signals we have started processing. Ensures a given signal is
 * handled at most once.
 */
const signalsHandled: Partial<Record<NodeJS.Signals, boolean>> = {}

async function rejectAfter(timeout: number, reason: any) {
  return new Promise<never>((resolve, reject) => {
    setTimeout(() => reject(reason), timeout)
  })
}

function signalToExitCode(signal: NodeJS.Signals) {
  const signalNum = constants.signals[signal]
  return signalNum ? 128 + signalNum : undefined
}

function getHandlersForSignal(signal: NodeJS.Signals) {
  if (!signalHandlers.has(signal)) signalHandlers.set(signal, new Map())
  return signalHandlers.get(signal) as Map<AdeiuHandler, AdeiuOptions>
}

function logErrors(signal: NodeJS.Signals, errors: Array<[Error, AdeiuHandler]>) {
  const supportsColor = Boolean(
    process.stdout.isTTY
    // Check for NO_COLOR environment variable (color suppression standard)
    && !process.env.NO_COLOR
    // Check for FORCE_COLOR environment variable (color forcing standard)
    || process.env.FORCE_COLOR
  )

  const red = (text: string) => (supportsColor ? `\u001B[31m${text}\u001B[0m` : text)

  process.stderr.write(red(`Encountered the following errors while responding to ${signal}:\n\n`))

  errors.forEach(([error, handler]) => {
    const handlerName = handler.name || 'anonymous'
    const stackLines = error.stack?.split('\n') ?? [error.message]
    process.stderr.write(`${stackLines.map((line, lineNumber) => {
      return lineNumber === 0
        ? red(`• ${line} (via handler: ${handlerName})`)
        : line
    }).join('\n')}\n\n`)
  })
}

async function handleSignal(signal: NodeJS.Signals) {
  // Ensure we only run once for a given signal.
  if (signalsHandled[signal]) return

  signalsHandled[signal] = true

  // Get the Set of user handlers we need to invoke for the provided signal.
  const handlersForSignal = getHandlersForSignal(signal)

  // There is an error in our handler (un)installation logic; this handler
  // should have been un-registered when the last remaining user handler for
  // this signal was un-registered.
  if (handlersForSignal.size === 0)
    throw new Error(`Unexpected error: Expected at least 1 handler for signal ${signal}, got 0.`)

  const errors: Array<[Error, AdeiuHandler]> = []

  await Promise.allSettled([...handlersForSignal.entries()].map(async ([handler, options]) => {
    try {
      // eslint-disable-next-line unicorn/prefer-ternary
      if (options.timeout) {
        await Promise.race([
          handler(signal),
          rejectAfter(options.timeout, new Error(`Operation timed-out after ${options.timeout}ms.`))
        ])
      } else {
        await handler(signal)
      }
    } catch (err: any) {
      errors.push([err, handler])
    }
  }))

  if (errors.length > 0) {
    logErrors(signal, errors)
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(signalToExitCode(signal) ?? 1)
  } else {
    // N.B. We use process.kill() here rather than process.exit() because it
    // causes any potential Node debuggers that are attached to detach from
    // the process so that it can cleanly exit.
    process.kill(process.pid, signal)
  }
}

/**
 * Register a handler that will be invoked when the current process receives a
 * POSIX shutdown signal.
 */
export default function adeiu(handler: AdeiuHandler, options: AdeiuOptions = {}) {
  const { signals = DEFAULT_SIGNALS, timeout } = options

  // Validate options.
  signals.forEach(signal => {
    if (typeof signal !== 'string')
      throw new TypeError(`Expected signal to be of type "string", got "${typeof signal}".`)
    if (!signal.startsWith('SIG'))
      throw new Error(`Invalid signal: ${signal}`)
  })

  if (typeof timeout !== 'number' && timeout !== undefined)
    throw new TypeError(`Expected type of "timeout" to be "number" or "undefined", got "${typeof timeout}".`)

  signals.forEach(signal => {
    const handlersForSignal = getHandlersForSignal(signal)

    // Since this is the first handler being registered for this signal,
    // install our handler for it.
    if (handlersForSignal.size === 0) {
      process.prependListener(signal, handleSignal as NodeJS.SignalsListener)
    }

    handlersForSignal.set(handler, options)
  })

  // Un-register the provided handler from the indicated signals.
  return () => {
    for (const signal of signals) {
      const handlersForSignal = getHandlersForSignal(signal)

      handlersForSignal.delete(handler)

      // If we are un-registering the last remaining handler for this signal,
      // then we should also un-register our handler for that signal from the
      // process' EventEmitter.
      if (handlersForSignal.size === 0) {
        process.removeListener(signal, handleSignal as NodeJS.SignalsListener)
      }
    }
  }
}