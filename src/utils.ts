import { constants } from 'node:os'

import type { AdeiuHandler } from 'types'

export async function rejectAfter(timeout: number, reason: any) {
  return new Promise<never>((resolve, reject) => {
    setTimeout(() => reject(reason), timeout)
  })
}

export function signalToExitCode(signal: NodeJS.Signals) {
  const signalNum = constants.signals[signal]
  return signalNum ? 128 + signalNum : undefined
}

export function logErrors(signal: NodeJS.Signals, errors: Array<[Error, AdeiuHandler]>) {
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