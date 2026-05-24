/**
 * OBS-2 — Best-effort observability wrapper (never blocks clinical runtime).
 */

function shouldWarnObservabilityFailure(): boolean {
  const env = process.env.NODE_ENV
  return env === 'development' || env === 'test'
}

/**
 * Runs an observability side-effect without awaiting in the caller's critical path.
 * Failures are swallowed in production; development/test emit console.warn only.
 */
export function safeObserve(label: string, fn: () => Promise<void>): void {
  void (async () => {
    try {
      await fn()
    } catch (error) {
      if (shouldWarnObservabilityFailure()) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[observability] ${label}: ${message}`)
      }
    }
  })()
}

/**
 * Awaitable variant for tests and smoke scripts.
 */
export async function safeObserveAwait(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (shouldWarnObservabilityFailure()) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[observability] ${label}: ${message}`)
    }
  }
}
