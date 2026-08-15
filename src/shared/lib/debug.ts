/**
 * Lightweight debug logging for development.
 * All output is suppressed in production builds.
 */

const IS_DEV = import.meta.env.DEV

type LogLevel = 'log' | 'warn' | 'error'

function createLogger(level: LogLevel) {
  return (tag: string, message: string, data?: unknown) => {
    if (!IS_DEV) return
    const prefix = `[${tag}]`
    if (data !== undefined) {
      console[level](prefix, message, data)
    } else {
      console[level](prefix, message)
    }
  }
}

/** Debug log - only in dev mode */
export const debug = createLogger('log')

/** Debug warning - only in dev mode */
export const debugWarn = createLogger('warn')

/** Debug error - only in dev mode */
export const debugError = createLogger('error')
