'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RegulatoryDocumentWithOwner } from '@/lib/regulatory-center/regulatory-master-documents'
import type { RegulatoryPersonnelEntry } from '@/lib/regulatory-center/regulatory-personnel'
import { DOCUMENT_TYPES, OWNER_TYPES, DOCUMENT_STATUSES } from '@/lib/regulatory-center/regulatory-master-documents'
import {
  createRegulatoryDocument,
  updateRegulatoryDocument,
  deactivateRegulatoryDocument,
  reactivateRegulatoryDocument,
} from '@/lib/regulatory-center/regulatory-document-actions'

// ── Props ────────────────────────────────────────────────────────────────────

type MasterDocumentsSectionProps = {
  documents: RegulatoryDocumentWithOwner[]
  personnel: RegulatoryPersonnelEntry[]
  organizationId: string
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, expirationDate }: { status: string; expirationDate?: string | null }) {
  // Check for expiring soon
  const expiringLabel = expirationDate ? getExpiringSoonLabel(expirationDate) : null

  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Inactive' },
    needs_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Needs Review' },
    expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
  }

  const c = cfg[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500', label: status }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
      {expiringLabel ?? c.label}
    </span>
  )
}

function getExpiringSoonLabel(expirationDate: string): string | null {
  const now = new Date()
  const exp = new Date(expirationDate)
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'Expired'
  if (days <= 30) return `Expires in ${days}d`
  if (days <= 60) return `Expires in ${days}d`
  if (days <= 90) return `Expires in ${days}d`
  return null
}

function DocumentTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      {type}
    </span>
  )
}

// ── Add/Edit form ────────────────────────────────────────────────────────────

function DocumentForm({
  initial,
  personnel,
  onClose,
  onSaved,
}: {
  initial?: RegulatoryDocumentWithOwner
  personnel: RegulatoryPersonnelEntry[]
  onClose: () => void
  onSaved: () => void
}) {
  const [docType, setDocType] = useState(initial?.document_type ?? 'CV')
  const [title, setTitle] = useState(initial?.document_title ?? '')
  const [ownerType, setOwnerType] = useState(initial?.owner_type ?? 'person')
  const [ownerPersonnelId, setOwnerPersonnelId] = useState(initial?.owner_personnel_id ?? '')
  const [reference, setReference] = useState(initial?.document_reference ?? '')
  const [version, setVersion] = useState(initial?.version ?? '')
  const [effectiveDate, setEffectiveDate] = useState(initial?.effective_date ?? '')
  const [expirationDate, setExpirationDate] = useState(initial?.expiration_date ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim()) {
        setError('Document title is required')
        return
      }
      setError(null)
      setSubmitting(true)

      const result = initial
        ? await updateRegulatoryDocument({
            id: initial.id,
            documentType: docType,
            documentTitle: title.trim(),
            documentReference: reference.trim() || null,
            version: version.trim() || null,
            effectiveDate: effectiveDate || null,
            expirationDate: expirationDate || null,
            notes: notes.trim() || null,
            ownerType,
            ownerPersonnelId: ownerPersonnelId || null,
          })
        : await createRegulatoryDocument({
            ownerType: ownerType as any,
            ownerPersonnelId: ownerPersonnelId || null,
            documentType: docType,
            documentTitle: title.trim(),
            documentReference: reference.trim() || null,
            version: version.trim() || null,
            effectiveDate: effectiveDate || null,
            expirationDate: expirationDate || null,
            notes: notes.trim() || null,
          })

      setSubmitting(false)
      if (result.ok) {
        onSaved()
      } else {
        setError(result.error ?? 'Failed to save')
      }
    },
    [initial, docType, title, ownerType, ownerPersonnelId, reference, version, effectiveDate, expirationDate, notes, onSaved],
  )

  const personnelFiltered = personnel.filter((p) => p.status === 'active')

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">
        {initial ? 'Edit Document' : 'Add Document'}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Document Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="e.g. Dr. Smith CV v3"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Owner Type</label>
          <select
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {OWNER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Personnel (if owner is person)</label>
          <select
            value={ownerPersonnelId}
            onChange={(e) => setOwnerPersonnelId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— None —</option>
            {personnelFiltered.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Reference / File URL</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="s3://... or document ID"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Version</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="e.g. 1.0, v3"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Effective Date</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Expiration Date</label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : initial ? 'Save Changes' : 'Add Document'}
        </button>
      </div>
    </form>
  )
}

// ── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  doc: RegulatoryDocumentWithOwner
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{doc.document_title}</h3>
            <DocumentTypeBadge type={doc.document_type} />
            <StatusBadge status={doc.status} expirationDate={doc.expiration_date} />
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            <p>
              <span className="font-medium text-slate-400">Owner:</span>{' '}
              {doc.owner_name ?? doc.owner_type}
            </p>
            {doc.version && <p><span className="font-medium text-slate-400">Version:</span> {doc.version}</p>}
            {doc.document_reference && (
              <p className="truncate"><span className="font-medium text-slate-400">Ref:</span> {doc.document_reference}</p>
            )}
            <div className="flex gap-3">
              {doc.effective_date && <p><span className="font-medium text-slate-400">Effective:</span> {new Date(doc.effective_date).toLocaleDateString()}</p>}
              {doc.expiration_date && <p><span className="font-medium text-slate-400">Expires:</span> {new Date(doc.expiration_date).toLocaleDateString()}</p>}
            </div>
            {doc.notes && <p className="mt-1 italic text-slate-400">{doc.notes}</p>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2">
        <button type="button" onClick={onEdit} className="text-xs text-slate-400 hover:text-slate-700">Edit</button>
        {doc.status === 'active' ? (
          <button type="button" onClick={onDeactivate} className="text-xs text-slate-400 hover:text-amber-600">Deactivate</button>
        ) : (
          <button type="button" onClick={onReactivate} className="text-xs text-slate-400 hover:text-green-600">Reactivate</button>
        )}
      </div>
    </div>
  )
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  typeFilter: string
  onTypeFilterChange: (v: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by title, type, owner..."
        className="min-w-[200px] rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        <option value="">All Types</option>
        {DOCUMENT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        <option value="">All Statuses</option>
        {DOCUMENT_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function MasterDocumentsSection({
  documents,
  personnel,
  organizationId: _orgId,
}: MasterDocumentsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RegulatoryDocumentWithOwner | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const router = useRouter()

  const refresh = useCallback(() => {
    setShowForm(false)
    setEditing(null)
    router.refresh()
  }, [router])

  const filtered = documents.filter((d) => {
    if (typeFilter && d.document_type !== typeFilter) return false
    if (statusFilter && d.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !d.document_title.toLowerCase().includes(q) &&
        !d.document_type.toLowerCase().includes(q) &&
        !(d.owner_name ?? '').toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  const activeDocs = filtered.filter((d) => d.status === 'active')
  const otherDocs = filtered.filter((d) => d.status !== 'active')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Master Documents</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {documents.length} documents · {documents.filter((d) => d.status === 'active').length} active
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(!showForm) }}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancel' : 'Add Document'}
        </button>
      </div>

      {/* Form */}
      {showForm && !editing && (
        <div className="mt-4">
          <DocumentForm personnel={personnel} onClose={() => setShowForm(false)} onSaved={refresh} />
        </div>
      )}
      {editing && (
        <div className="mt-4">
          <DocumentForm initial={editing} personnel={personnel} onClose={() => setEditing(null)} onSaved={refresh} />
        </div>
      )}

      {/* Filters */}
      <div className="mt-4">
        <FilterBar
          search={search} onSearchChange={setSearch}
          typeFilter={typeFilter} onTypeFilterChange={setTypeFilter}
          statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        />
      </div>

      {/* Empty state */}
      {documents.length === 0 && !showForm && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-400">No master documents</p>
          <p className="mt-1 text-xs text-slate-300">Add the first regulatory document to get started.</p>
        </div>
      )}

      {/* Active docs */}
      {activeDocs.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active ({activeDocs.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeDocs.map((d) => (
              <DocumentCard
                key={d.id}
                doc={d}
                onEdit={() => setEditing(d)}
                onDeactivate={async () => { await deactivateRegulatoryDocument(d.id); router.refresh() }}
                onReactivate={async () => { await reactivateRegulatoryDocument(d.id); router.refresh() }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other docs */}
      {otherDocs.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Other ({otherDocs.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherDocs.map((d) => (
              <DocumentCard
                key={d.id}
                doc={d}
                onEdit={() => setEditing(d)}
                onDeactivate={async () => { await deactivateRegulatoryDocument(d.id); router.refresh() }}
                onReactivate={async () => { await reactivateRegulatoryDocument(d.id); router.refresh() }}
              />
            ))}
          </div>
        </div>
      )}

      {/* No filter results */}
      {documents.length > 0 && filtered.length === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-xs text-slate-400">No documents match your filters.</p>
        </div>
      )}
    </div>
  )
}
