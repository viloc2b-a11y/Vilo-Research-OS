'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RegulatoryDocumentWithOwner } from '@/lib/regulatory-center/regulatory-master-documents'
import { buildExpirationSummary, getDaysRemaining, type ExpirationBucketLabel } from '@/lib/regulatory-center/regulatory-expiration'
import { updateRegulatoryDocument, deactivateRegulatoryDocument, reactivateRegulatoryDocument } from '@/lib/regulatory-center/regulatory-document-actions'

// ── Props ────────────────────────────────────────────────────────────────────

type ExpirationsSectionProps = {
  documents: RegulatoryDocumentWithOwner[]
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function ExpirationBadge({ bucket, days }: { bucket: string; days?: number }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
    expiring_30: { bg: 'bg-red-100', text: 'text-red-700', label: `${days ?? 0}d remaining` },
    expiring_60: { bg: 'bg-amber-100', text: 'text-amber-700', label: `${days ?? 0}d remaining` },
    expiring_90: { bg: 'bg-amber-100', text: 'text-amber-700', label: `${days ?? 0}d remaining` },
    needs_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Needs Review' },
    missing_expiration: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'No Expiration' },
    valid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Valid' },
  }
  const c = cfg[bucket] ?? { bg: 'bg-slate-100', text: 'text-slate-500', label: bucket }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ── Expiration Card ──────────────────────────────────────────────────────────

function ExpirationDocCard({
  doc,
  bucket,
  onEdit,
}: {
  doc: RegulatoryDocumentWithOwner
  bucket: string
  onEdit: () => void
}) {
  const days = doc.expiration_date ? getDaysRemaining(doc.expiration_date) : undefined

  return (
    <div className="flex items-start justify-between rounded-md border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-800">{doc.document_title}</span>
          <ExpirationBadge bucket={bucket} days={days} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="font-medium text-slate-400">{doc.document_type}</span>
          <span>Owner: {doc.owner_name ?? doc.owner_type}</span>
          {doc.expiration_date && (
            <span className={days !== undefined && days < 0 ? 'text-red-500 font-medium' : ''}>
              {new Date(doc.expiration_date).toLocaleDateString()} ({days !== undefined ? (days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`) : ''})
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="ml-3 shrink-0 text-xs text-slate-400 hover:text-slate-700"
      >
        Edit
      </button>
    </div>
  )
}

// ── Edit Form (inline) ───────────────────────────────────────────────────────

function EditExpirationForm({
  doc,
  onClose,
  onSaved,
}: {
  doc: RegulatoryDocumentWithOwner
  onClose: () => void
  onSaved: () => void
}) {
  const [expirationDate, setExpirationDate] = useState(doc.expiration_date ?? '')
  const [status, setStatus] = useState(doc.status)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await updateRegulatoryDocument({
      id: doc.id,
      expirationDate: expirationDate || null,
      status: status as any,
    })
    setSubmitting(false)
    if (result.ok) {
      router.refresh()
      onSaved()
    } else {
      setError(result.error ?? 'Failed to update')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 p-3">
      <div className="flex-1">
        <p className="text-xs font-medium text-teal-800">{doc.document_title}</p>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-teal-600">Expiration</label>
        <input
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
          className="mt-0.5 rounded border border-teal-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-teal-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-0.5 rounded border border-teal-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
        >
          <option value="active">Active</option>
          <option value="needs_review">Needs Review</option>
          <option value="expired">Expired</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {submitting ? '...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Bucket Section ───────────────────────────────────────────────────────────

function BucketSection({
  bucket,
  count,
  label,
  docs,
}: ExpirationBucketLabel) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const router = useRouter()

  const borderColor =
    bucket === 'expired' ? 'border-red-200' :
    bucket === 'expiring_30' ? 'border-red-200' :
    bucket === 'needs_review' ? 'border-amber-200' :
    bucket === 'missing_expiration' ? 'border-slate-200' :
    'border-slate-100'

  return (
    <div className={`rounded-md border ${borderColor} bg-white p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
          <span className="ml-1 text-slate-400">({count})</span>
        </h3>
      </div>
      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id}>
            {editingId === doc.id ? (
              <EditExpirationForm
                doc={doc}
                onClose={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <ExpirationDocCard
                doc={doc}
                bucket={bucket}
                onEdit={() => setEditingId(doc.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function ExpirationsSection({ documents }: ExpirationsSectionProps) {
  const summary = buildExpirationSummary(documents)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Expiration Intelligence</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {summary.totalDocs} active documents · {summary.expiringOrExpired} expiring or expired · {summary.needsReviewCount} needs review
        </p>
      </div>

      {/* Metric cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Expired"
          count={summary.buckets.find((b) => b.bucket === 'expired')?.count ?? 0}
          color="text-red-600"
        />
        <MetricCard
          label="Expiring ≤30d"
          count={summary.buckets.find((b) => b.bucket === 'expiring_30')?.count ?? 0}
          color="text-red-600"
        />
        <MetricCard
          label="Expiring ≤60d"
          count={summary.buckets.find((b) => b.bucket === 'expiring_60')?.count ?? 0}
          color="text-amber-600"
        />
        <MetricCard
          label="Needs Review"
          count={summary.needsReviewCount}
          color="text-amber-600"
        />
      </div>

      {/* No docs state */}
      {summary.totalDocs === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-400">No documents registered yet</p>
          <p className="mt-1 text-xs text-slate-300">
            Add master documents to see expiration intelligence.
          </p>
        </div>
      )}

      {/* All clear state */}
      {summary.totalDocs > 0 && summary.expiringOrExpired === 0 && summary.needsReviewCount === 0 && (
        <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-700">All documents are valid</p>
          <p className="mt-1 text-xs text-green-600">
            No documents expiring within 90 days. {summary.validCount} valid document(s).
          </p>
        </div>
      )}

      {/* Bucketed sections — priority ordered */}
      {summary.buckets
        .filter((b) => b.bucket !== 'valid' && b.count > 0)
        .map((b) => (
          <div key={b.bucket} className="mt-4">
            <BucketSection {...b} />
          </div>
        ))}

      {/* Valid section (collapsed) */}
      {summary.buckets.find((b) => b.bucket === 'valid' && b.count > 0) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
            Valid Documents ({summary.validCount})
          </summary>
          <div className="mt-3 space-y-2">
            {summary.buckets
              .filter((b) => b.bucket === 'valid')
              .flatMap((b) => b.docs)
              .map((doc) => (
                <div key={doc.id} className="rounded-md border border-slate-100 bg-slate-50 p-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{doc.document_title}</span>
                  <span className="ml-2 text-slate-400">· {doc.document_type}</span>
                  {doc.owner_name && <span className="ml-2 text-slate-400">· {doc.owner_name}</span>}
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  )
}
