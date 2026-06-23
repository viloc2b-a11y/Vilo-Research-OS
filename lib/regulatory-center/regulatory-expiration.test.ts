import { describe, expect, it } from 'vitest'
import { getExpirationBucket, buildExpirationSummary, getDaysRemaining } from './regulatory-expiration'
import type { RegulatoryDocumentWithOwner } from './regulatory-master-documents'

function makeDoc(over: Partial<RegulatoryDocumentWithOwner> = {}): RegulatoryDocumentWithOwner {
  return {
    id: 'doc-1',
    organization_id: 'org-1',
    owner_type: 'person',
    owner_personnel_id: null,
    document_type: 'CV',
    document_title: 'Test Document',
    document_reference: null,
    version: null,
    effective_date: null,
    expiration_date: null,
    status: 'active',
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    owner_name: null,
    ...over,
  }
}

function futureDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

function pastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

describe('getExpirationBucket', () => {
  it('returns expired for past expiration date', () => {
    const doc = makeDoc({ expiration_date: pastDate(5) })
    expect(getExpirationBucket(doc)).toBe('expired')
  })

  it('returns expiring_30 for expiration within 30 days', () => {
    const doc = makeDoc({ expiration_date: futureDate(15) })
    expect(getExpirationBucket(doc)).toBe('expiring_30')
  })

  it('returns expiring_60 for expiration within 60 days', () => {
    const doc = makeDoc({ expiration_date: futureDate(45) })
    expect(getExpirationBucket(doc)).toBe('expiring_60')
  })

  it('returns expiring_90 for expiration within 90 days', () => {
    const doc = makeDoc({ expiration_date: futureDate(75) })
    expect(getExpirationBucket(doc)).toBe('expiring_90')
  })

  it('returns valid for expiration beyond 90 days', () => {
    const doc = makeDoc({ expiration_date: futureDate(200) })
    expect(getExpirationBucket(doc)).toBe('valid')
  })

  it('returns needs_review for needs_review status', () => {
    const doc = makeDoc({ status: 'needs_review' })
    expect(getExpirationBucket(doc)).toBe('needs_review')
  })

  it('returns valid for inactive status', () => {
    const doc = makeDoc({ status: 'inactive' })
    expect(getExpirationBucket(doc)).toBe('valid')
  })

  it('returns expired for expired status', () => {
    const doc = makeDoc({ status: 'expired' })
    expect(getExpirationBucket(doc)).toBe('expired')
  })

  it('returns missing_expiration for active doc without expiration when type expects one', () => {
    const doc = makeDoc({ document_type: 'Medical License', expiration_date: null })
    expect(getExpirationBucket(doc)).toBe('missing_expiration')
  })

  it('returns valid for active doc without expiration when type does not expect one', () => {
    const doc = makeDoc({ document_type: 'CV', expiration_date: null })
    expect(getExpirationBucket(doc)).toBe('valid')
  })
})

describe('buildExpirationSummary', () => {
  it('returns empty summary for no documents', () => {
    const summary = buildExpirationSummary([])
    expect(summary.totalDocs).toBe(0)
    expect(summary.buckets).toHaveLength(0)
  })

  it('correctly categorizes documents into buckets', () => {
    const docs = [
      makeDoc({ id: '1', expiration_date: pastDate(5) }),
      makeDoc({ id: '2', expiration_date: futureDate(15) }),
      makeDoc({ id: '3', expiration_date: futureDate(45) }),
      makeDoc({ id: '4', expiration_date: futureDate(200) }),
      makeDoc({ id: '5', status: 'needs_review' }),
      makeDoc({ id: '6', document_type: 'Medical License', expiration_date: null }),
    ]

    const summary = buildExpirationSummary(docs)

    expect(summary.totalDocs).toBe(6)
    expect(summary.buckets.find((b) => b.bucket === 'expired')?.count).toBe(1)
    expect(summary.buckets.find((b) => b.bucket === 'expiring_30')?.count).toBe(1)
    expect(summary.buckets.find((b) => b.bucket === 'expiring_60')?.count).toBe(1)
    expect(summary.buckets.find((b) => b.bucket === 'valid')?.count).toBe(1)
    expect(summary.buckets.find((b) => b.bucket === 'needs_review')?.count).toBe(1)
    expect(summary.buckets.find((b) => b.bucket === 'missing_expiration')?.count).toBe(1)
  })

  it('excludes inactive documents from total', () => {
    const docs = [
      makeDoc({ id: '1', status: 'inactive', expiration_date: pastDate(5) }),
      makeDoc({ id: '2', expiration_date: futureDate(200) }),
    ]
    const summary = buildExpirationSummary(docs)
    expect(summary.totalDocs).toBe(1) // only the active one
    expect(summary.validCount).toBe(1)
  })
})
