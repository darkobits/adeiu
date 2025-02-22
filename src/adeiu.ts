/**
 * Signature of callbacks provided to `adeiu`.
 */
export type AdeiuCallback = (signal: NodeJS.Signals) => void | Promise<void>;

/**
 * Optional options object that may be passed to `adeiu`.
 */
export interface AdeiuOptions {
  /**
   * (Optional) Array of signals that the provided callback should be invoked
   * for. These signals are _not_ merged with the defaults, so each desired
   * signal must be explicitly enumerated.
   */
  signals?: Array<NodeJS.Signals>
}

/**
 * List of default POSIX signals to register handlers for.
 */
const SIGNALS: Array<NodeJS.Signals> = [
  'SIGINT',
  'SIGQUIT',
  'SIGTERM',
  // Signal sent by nodemon to child processes when it needs to restart them.
  'SIGUSR2'
]

/**
 * Tracks which signals we have registered process listeners for, and which user
 * callbacks should be invoked for each signal.
 */
const signalCallbacks = new Map<NodeJS.Signals, Set<AdeiuCallback>>()

/**
 * Returns the `Set` of user-provided callbacks for the provided signal.
 */
function getCallbackSetForSignal(signal: NodeJS.Signals) {
  // Initialize w new Set if needed.
  if (!signalCallbacks.has(signal)) signalCallbacks.set(signal, new Set())
  return signalCallbacks.get(signal) as Set<AdeiuCallback>
}

/**
 * Provided an `adeiu` callback and an error it threw, logs the error to
 * stderr.
 *
 * @example
 *
 * const myCallback = () => {
 *   throw new TypeError('Oh noes!');
 * };
 *
 * ```
 * Error: [adeiu] SIGINT handler `myCallback` threw: TypeError: Oh noes!
 *   at myCallback (foo.js:42:3)
 * ```
 */
function writeErrorToStderr(cb: AdeiuCallback, signal: NodeJS.Signals, err?: Error) {
  if (err?.stack) {
    const supportsColor = Boolean(
      process.stdout.isTTY
      // Check for NO_COLOR environment variable (color suppression standard)
      && !process.env.NO_COLOR
      // Check for FORCE_COLOR environment variable (color forcing standard)
      || process.env.FORCE_COLOR
    )

    const red = (text: string) => (supportsColor ? `\u001B[31m${text}\u001B[0m` : text)

    const errType = err.constructor ? err.constructor.name : 'Error'
    const cbName = cb.name ? `${signal} handler  \`${cb.name}\`` : 'Anonymous callback'
    const stackLines = err.stack.split('\n')
    stackLines[0] = `${red(`Error: [adeiu] ${cbName} threw:`)} ${errType}: ${err.message}`
    process.stderr.write(`${stackLines.join('\n')}\n`)
  }
}

/**
 * Common signal handler; concurrently calls each callback registered for the
 * provided signal. If any callbacks throw or reject, the process will exit with
 * code 1.
 */
async function handler(signal: NodeJS.Signals) {
  // Get an array of user callbacks we need to invoke for the provided signal.
  const callbackSetForSignal = getCallbackSetForSignal(signal)

  // There is an error in our handler (un)installation logic; this handler
  // should have been un-registered when the last remaining user callback for
  // this signal was un-registered.
  if (callbackSetForSignal.size === 0)
    throw new Error(`Unexpected error: Expected at least 1 callback for signal ${signal}, but found none.`)

  let anyFailed = false

  await Promise.all([...callbackSetForSignal].map(async cb => {
    try {
      await cb(signal)
    } catch (err: any) {
      anyFailed = true
      writeErrorToStderr(cb, signal, err)
    }
  }))

  if (anyFailed) {
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1)
  } else {
    // N.B. We use process.kill() here rather than process.exit() because it
    // causes any potential Node debuggers that are attached to detach from the
    // process so that it can cleanly exit.
    process.kill(process.pid, signal)
  }
}

/**
 * Provided a function, registers a callback with several common POSIX signals
 * that will invoke the function upon receipt of any of the signals.
 *
 * Returns a function that, when invoked, will unregister the callback.
 */
export default function adeiu(cb: AdeiuCallback, {signals = []}: AdeiuOptions = {}) {
  // Validate options.
  signals.forEach(signal => {
    if (typeof signal !== 'string') throw new TypeError(`Expected signal to be of type "string", got "${typeof signal}".`)
    if (!signal.startsWith('SIG')) throw new Error(`Invalid signal: ${signal}`)
  })

  // If the user provided a custom list of signals, use it. Otherwise, use the
  // default list.
  const resolvedSignals = signals.length > 0 ? signals : SIGNALS

  resolvedSignals.forEach(signal => {
    const callbackSetForSignal = getCallbackSetForSignal(signal)

    // Since this is the first callback being registered for this signal,
    // install our handler for it.
    if (callbackSetForSignal.size === 0) {
      process.prependListener(signal, handler as NodeJS.SignalsListener)
    }

    callbackSetForSignal.add(cb)
  })

  // Un-register the provided callback from the indicated signals.
  return () => {
    for (const signal of resolvedSignals) {
      const callbackSetForSignal = getCallbackSetForSignal(signal)

      callbackSetForSignal.delete(cb)

      // If we are un-registering the last remaining callback for this signal,
      // then we should also un-register our handler for that signal from the
      // process' EventEmitter.
      if (callbackSetForSignal.size === 0) {
        process.removeListener(signal, handler as NodeJS.SignalsListener)
      }
    }
  }
}

/**
 * Attach signals to adeiu.
 */
adeiu.SIGNALS = SIGNALS