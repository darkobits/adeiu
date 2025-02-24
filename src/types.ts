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