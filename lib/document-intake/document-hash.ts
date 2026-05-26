import { createHash } from 'crypto'

/**
 * Computes a deterministic SHA-256 hash for a file buffer.
 * To be used on the server before storing the blob.
 */
export function computeDocumentHash(fileBuffer: Buffer): string {
  const hash = createHash('sha256')
  hash.update(fileBuffer)
  return hash.digest('hex')
}

/**
 * Computes a state hash for the audit ledger to ensure immutability.
 */
export function computeAuditLedgerStateHash(
  documentId: string,
  eventType: string,
  timestamp: string,
  payload: Record<string, unknown>
): string {
  const hash = createHash('sha256')
  const serializedState = JSON.stringify({ documentId, eventType, timestamp, payload })
  hash.update(serializedState)
  return hash.digest('hex')
}
