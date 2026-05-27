import { createHash } from 'crypto'

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export function hashChunkText(cleanText: string, index: number, documentId: string): string {
  return createHash('sha256')
    .update(`${documentId}:${index}:${cleanText}`)
    .digest('hex')
}

export function hashQueryText(query: string): string {
  return createHash('sha256').update(query.trim().toLowerCase()).digest('hex')
}

export function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, 500)
}
