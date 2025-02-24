import { logErrors, rejectAfter, signalToExitCode  } from 'utils'

import type { AdeiuHandler, AdeiuOptions } from 'types'

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

function getHandlersForSignal(signal: NodeJS.Signals) {
  if (!signalHandlers.has(signal)) signalHandlers.set(signal, new Map())
  return signalHandlers.get(signal) as Map<AdeiuHandler, AdeiuOptions>
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

  for (const signal of signals) {
    const handlersForSignal = getHandlersForSignal(signal)
    handlersForSignal.set(handler, options)

    // If this is the first handler being registered for this signal,
    // install our listener.
    if (handlersForSignal.size === 1) process.prependListener(
      signal,
      handleSignal as NodeJS.SignalsListener
    )
  }

  const unregister = () => {
    for (const signal of signals) {
      const handlersForSignal = getHandlersForSignal(signal)
      handlersForSignal.delete(handler)

      // If this is the last handler being un-registered for this signal,
      // uninstall our listener.
      if (handlersForSignal.size === 0) process.removeListener(
        signal,
        handleSignal as NodeJS.SignalsListener
      )
    }
  }

  return unregister
}