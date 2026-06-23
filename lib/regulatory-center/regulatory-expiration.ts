import type { RegulatoryDocumentWithOwner } from './regulatory-master-documents'

// ── Expiration bucket types ──────────────────────────────────────────────────

export type ExpirationBucket =
  | 'expired'
  | 'expiring_30'
  | 'expiring_60'
  | 'expiring_90'
  | 'needs_review'
  | 'missing_expiration'
  | 'valid'

export type ExpirationBucketLabel = {
  bucket: ExpirationBucket
  label: string
  count: number
  docs: RegulatoryDocumentWithOwner[]
}

export type ExpirationSummary = {
  buckets: ExpirationBucketLabel[]
  totalDocs: number
  expiringOrExpired: number
  needsReviewCount: number
  validCount: number
}

// ── Expiration bucket helper ─────────────────────────────────────────────────

export function getExpirationBucket(
  doc: RegulatoryDocumentWithOwner,
): ExpirationBucket {
  // Status-based buckets
  if (doc.status === 'needs_review') return 'needs_review'
  if (doc.status === 'inactive') return 'valid' // inactive docs don't need attention
  if (doc.status === 'expired') return 'expired'

  // Expiration date based
  if (!doc.expiration_date) {
    // Active docs without expiration that probably should have one
    const typesExpectingExpiration = [
      'Medical License', 'DEA', 'GCP', 'IATA', 'HSP',
      'Financial Disclosure', 'CLIA', 'CAP', 'Insurance',
      'Lab Certification',
    ]
    if (typesExpectingExpiration.includes(doc.document_type)) {
      return 'missing_expiration'
    }
    return 'valid'
  }

  const now = new Date()
  const exp = new Date(doc.expiration_date)
  const daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= 30) return 'expiring_30'
  if (daysRemaining <= 60) return 'expiring_60'
  if (daysRemaining <= 90) return 'expiring_90'

  return 'valid'
}

export function getDaysRemaining(expirationDate: string): number {
  const now = new Date()
  const exp = new Date(expirationDate)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Summary builder ──────────────────────────────────────────────────────────

export function buildExpirationSummary(
  docs: RegulatoryDocumentWithOwner[],
): ExpirationSummary {
  const activeDocs = docs.filter((d) => d.status !== 'inactive')

  const bucketOrder: ExpirationBucket[] = [
    'expired',
    'expiring_30',
    'needs_review',
    'expiring_60',
    'expiring_90',
    'missing_expiration',
    'valid',
  ]

  const bucketLabels: Record<ExpirationBucket, string> = {
    expired: 'Expired',
    expiring_30: 'Expiring Within 30 Days',
    expiring_60: 'Expiring Within 60 Days',
    expiring_90: 'Expiring Within 90 Days',
    needs_review: 'Needs Review',
    missing_expiration: 'Missing Expiration Date',
    valid: 'Valid',
  }

  const bucketMap = new Map<ExpirationBucket, RegulatoryDocumentWithOwner[]>()
  for (const bucket of bucketOrder) {
    bucketMap.set(bucket, [])
  }

  for (const doc of activeDocs) {
    const bucket = getExpirationBucket(doc)
    const list = bucketMap.get(bucket)
    if (list) list.push(doc)
  }

  const buckets: ExpirationBucketLabel[] = bucketOrder
    .filter((b) => (bucketMap.get(b)?.length ?? 0) > 0)
    .map((b) => ({
      bucket: b,
      label: bucketLabels[b],
      count: bucketMap.get(b)?.length ?? 0,
      docs: bucketMap.get(b) ?? [],
    }))

  const totalDocs = activeDocs.length
  const expiringOrExpired = buckets
    .filter((b) => ['expired', 'expiring_30', 'expiring_60', 'expiring_90'].includes(b.bucket))
    .reduce((sum, b) => sum + b.count, 0)
  const needsReviewCount = buckets.find((b) => b.bucket === 'needs_review')?.count ?? 0
  const validCount = buckets.find((b) => b.bucket === 'valid')?.count ?? 0

  return { buckets, totalDocs, expiringOrExpired, needsReviewCount, validCount }
}
