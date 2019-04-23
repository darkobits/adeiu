import chalk from 'chalk';
import ow from 'ow';


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
  signals?: Array<NodeJS.Signals>;
}


/**
 * List of default POSIX signals to register handlers for.
 */
export const SIGNALS: Array<NodeJS.Signals> = [
  'SIGINT',
  'SIGQUIT',
  'SIGTERM',
  'SIGUSR2'
];


/**
 * Tracks which signals we have registered process listeners for, and which user
 * callbacks should be invoked for each signal.
 */
const signalCallbacks = new Map<NodeJS.Signals, Array<AdeiuCallback>>();


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
 * Error: [adeiu] Callback `myCallback` threw: TypeError: Oh noes!
 *   at myCallback (foo.js:42:3)
 * ```
 */
function writeErrorToStderr(cb: AdeiuCallback, err?: Error) {
  if (err && err.stack) {
    const errType = err.constructor ? err.constructor.name : 'Error';
    const cbName = cb.name ? `Callback  \`${cb.name}\`` : 'Anonymous callback';
    const stackLines = err.stack.split('\n');
    stackLines[0] = `${chalk.red(`Error: [adeiu] ${cbName} threw:`)} ${errType}: ${err.message}`;
    process.stderr.write(`${stackLines.join('\n')}\n`);
  }
}


/**
 * Common signal handler; concurrently calls each callback registered for the
 * provided signal. If any callbacks throw or reject, the process will exit with
 * code 1.
 */
async function handler(signal: NodeJS.Signals) {
  // Get an array of user callbacks we need to invoke for the provided signal.
  const callbacksForSignal = signalCallbacks.get(signal);

  // If this occurs, it means there is an error in our handler (un)installation
  // logic.
  if (!callbacksForSignal || callbacksForSignal.length === 0) {
    throw new Error(`Unexpected error: Expected at least 1 callback for signal ${signal}, but found none.`);
  }

  // Map our array of functions into an array of promises that will resolve with
  // `true` if the function returns/resolves and `false` if the function throws
  // or rejects.
  const results = await Promise.all(callbacksForSignal.map(async cb => {
    try {
      await cb(signal);
      return true;
    } catch (err) {
      writeErrorToStderr(cb, err);
      return false;
    }
  }));

  if (results.includes(false)) {
    // If any functions threw/rejected, exit with code 1.
    process.exit(1);
  } else {
    // N.B. We use process.kill() here rather than process.exit() because it
    // causes any potential Node debuggers that are attached to detach from the
    // process so that it can cleanly exit.
    process.kill(process.pid, signal);
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
  ow(signals, 'signals', ow.array);

  // If the user provided a custom list of signals, use it. Otherwise, use the
  // default list.
  const finalSignals = signals.length > 0 ? signals : SIGNALS;

  finalSignals.forEach(signal => {
    const callbacksForSignal = signalCallbacks.get(signal);

    if (!callbacksForSignal || callbacksForSignal.length === 0) {
      signalCallbacks.set(signal, [cb]);
      // Since this is the first callback being registered for this signal,
      // install our handler for it.
      process.prependOnceListener(signal, handler);
    } else {
      signalCallbacks.set(signal, [...callbacksForSignal, cb]);
    }
  });

  return () => {
    finalSignals.forEach(signal => {
      const callbacksForSignal = signalCallbacks.get(signal);

      if (!callbacksForSignal || callbacksForSignal.length === 0) {
        // User may have alreay called this function previously.
        return;
      }

      if (callbacksForSignal.length === 1 && callbacksForSignal[0] === cb) {
        signalCallbacks.set(signal, []);
        // This means we are un-registering the last remaining callback for this
        // signal, so uninstall our handler for it.
        process.off(signal, handler);
      } else {
        signalCallbacks.set(signal, callbacksForSignal.filter(curCallback => curCallback !== cb));
      }
    });
  };
}