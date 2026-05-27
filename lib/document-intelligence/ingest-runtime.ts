/** Wall-clock budget for synchronous ingest response (below Vercel maxDuration). */
export const INGEST_RESPONSE_DEADLINE_MS = 50_000

export function createIngestDeadline(deadlineMs = INGEST_RESPONSE_DEADLINE_MS): number {
  return Date.now() + deadlineMs
}

export function isIngestDeadlineExceeded(deadlineAtMs: number): boolean {
  return Date.now() >= deadlineAtMs
}
