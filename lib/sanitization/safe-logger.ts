import { sanitizeObjectDeep, sanitizeProtocolText } from '@/lib/sanitization/protocol-sanitizer'

type LogLevel = 'info' | 'warn' | 'error'

function sanitizeLogArg(arg: unknown): unknown {
  if (typeof arg === 'string') return sanitizeProtocolText(arg)
  if (arg instanceof Error) {
    return {
      name: sanitizeProtocolText(arg.name),
      message: sanitizeProtocolText(arg.message),
      stack: arg.stack ? sanitizeProtocolText(arg.stack) : undefined,
    }
  }
  return sanitizeObjectDeep(arg)
}

function write(level: LogLevel, args: unknown[]) {
  const sanitized = args.map(sanitizeLogArg)
  console[level](...sanitized)
}

export const safeLogger = {
  info: (...args: unknown[]) => write('info', args),
  warn: (...args: unknown[]) => write('warn', args),
  error: (...args: unknown[]) => write('error', args),
}
