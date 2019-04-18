/**
 * Signature of callbacks provided to `adeiu`.
 */
export type AdeiuCallback = (signal: NodeJS.Signals) => void | Promise<void>;


/**
 * List of POSIX signals to register handlers for.
 */
const SIGNALS: Array<NodeJS.Signals> = [
  'SIGINT',
  'SIGQUIT',
  'SIGTERM',
  'SIGUSR2'
];


/**
 * Tracks registered callbcks.
 */
const callbacks = new Set<AdeiuCallback>();


/**
 * Tracks whether we have registered our signal-handler.
 */
let handlerRegistered = false;


/**
 * Common signal handler; concurrently calls each registered callback. If any
 * callbacks throw or reject, the process will exit with code 1. Otherwise, the
 * process will exit with code 0 via the signal we received.
 */
async function handler(signal: NodeJS.Signals) {
  const callbackFns = Array.from(callbacks.values());

  // Map our array of functions into an array of promises that will resolve with
  // `true` if the function returns/resolves and `false` if the function throws
  // or rejects.
  const results = await Promise.all(callbackFns.map(async cb => {
    try {
      await cb(signal);
      return true;
    } catch (err) {
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
export default function adeiu(cb: AdeiuCallback) {
  if (!handlerRegistered) {
    SIGNALS.forEach(signal => {
      process.once(signal, handler);
    });

    handlerRegistered = true;
  }

  callbacks.add(cb);

  return () => {
    callbacks.delete(cb);
  };
}
