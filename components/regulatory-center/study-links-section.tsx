'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { StudyLinkWithDetails, StudyInfo } from '@/lib/regulatory-center/study-regulatory-links'
import type { RegulatoryPersonnelEntry } from '@/lib/regulatory-center/regulatory-personnel'
import type { RegulatoryDocumentWithOwner } from '@/lib/regulatory-center/regulatory-master-documents'
import { linkPersonnelToStudy, linkDocumentToStudy, deactivateStudyLink, reactivateStudyLink } from '@/lib/regulatory-center/study-link-actions'

// ── Props ────────────────────────────────────────────────────────────────────

type StudyLinksSectionProps = {
  studies: StudyInfo[]
  links: StudyLinkWithDetails[]
  personnel: RegulatoryPersonnelEntry[]
  documents: RegulatoryDocumentWithOwner[]
  organizationId: string
}

// ── Expiration Badge ─────────────────────────────────────────────────────────

function ExpirationBadge({ bucket }: { bucket?: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
    expiring_30: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expiring' },
    expiring_60: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Expiring' },
    expiring_90: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Expiring' },
    needs_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Needs Review' },
    missing_expiration: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'No Exp.' },
  }
  const c = cfg[bucket ?? ''] ?? null
  if (!c) return null
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>{c.label}</span>
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-slate-100 text-slate-500',
    needs_review: 'bg-amber-100 text-amber-700',
  }
  const c = cfg[status] ?? 'bg-slate-100 text-slate-500'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c}`}>{status}</span>
}

// ── Link Card ────────────────────────────────────────────────────────────────

function LinkCard({
  link,
  onDeactivate,
  onReactivate,
}: {
  link: StudyLinkWithDetails
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const isPersonnel = link.link_type === 'personnel'

  return (
    <div className="flex items-start justify-between rounded-md border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isPersonnel ? (
            <>
              <span className="text-sm font-medium text-slate-800">{link.personnel_name ?? 'Unknown'}</span>
              <span className="text-[10px] text-slate-400">{link.personnel_role}</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-slate-800">{link.document_title ?? 'Unknown'}</span>
              <span className="text-[10px] text-slate-400">{link.document_type}</span>
            </>
          )}
          <StatusBadge status={link.status} />
          <ExpirationBadge bucket={link.expiration_bucket} />
          {link.required && <span className="text-[10px] font-medium text-amber-600">Required</span>}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {isPersonnel
            ? `Personnel · ${link.personnel_status ?? 'unknown'}`
            : `Document · Owner: ${link.owner_name ?? link.document_status ?? 'unknown'}`}
        </p>
        {link.notes && <p className="mt-0.5 text-xs text-slate-400 italic">{link.notes}</p>}
      </div>
      <div className="ml-3 flex shrink-0 gap-2">
        {link.status === 'active' ? (
          <button type="button" onClick={onDeactivate} className="text-xs text-slate-400 hover:text-amber-600">Unlink</button>
        ) : (
          <button type="button" onClick={onReactivate} className="text-xs text-slate-400 hover:text-green-600">Relink</button>
        )}
      </div>
    </div>
  )
}

// ── Add Link Form ────────────────────────────────────────────────────────────

function AddLinkForm({
  studyId,
  personnel,
  documents,
  onClose,
  onSaved,
}: {
  studyId: string
  personnel: RegulatoryPersonnelEntry[]
  documents: RegulatoryDocumentWithOwner[]
  onClose: () => void
  onSaved: () => void
}) {
  const [linkType, setLinkType] = useState<'personnel' | 'document'>('personnel')
  const [selectedId, setSelectedId] = useState('')
  const [required, setRequired] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activePersonnel = personnel.filter((p) => p.status === 'active')
  const activeDocs = documents.filter((d) => d.status === 'active')

  const handleSubmit = useCallback(async () => {
    if (!selectedId) { setError('Please select an item'); return }
    setError(null)
    setSubmitting(true)

    const result = linkType === 'personnel'
      ? await linkPersonnelToStudy(studyId, selectedId, required, notes || null)
      : await linkDocumentToStudy(studyId, selectedId, required, notes || null)

    setSubmitting(false)
    if (result.ok) { onSaved() }
    else { setError(result.error ?? 'Failed') }
  }, [studyId, linkType, selectedId, required, notes, onSaved])

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h4 className="mb-3 text-xs font-semibold text-slate-700">Add Link to Study</h4>
      <div className="space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setLinkType('personnel')} className={`rounded px-3 py-1.5 text-xs font-medium ${linkType === 'personnel' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Personnel</button>
          <button type="button" onClick={() => setLinkType('document')} className={`rounded px-3 py-1.5 text-xs font-medium ${linkType === 'document' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Document</button>
        </div>

        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none">
          <option value="">Select {linkType}...</option>
          {linkType === 'personnel'
            ? activePersonnel.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)
            : activeDocs.map((d) => <option key={d.id} value={d.id}>{d.document_title} ({d.document_type})</option>)
          }
        </select>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="rounded" />
          Required for study
        </label>

        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none" />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {submitting ? 'Adding...' : 'Add Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function StudyLinksSection({
  studies,
  links,
  personnel,
  documents,
  organizationId: _orgId,
}: StudyLinksSectionProps) {
  const [selectedStudyId, setSelectedStudyId] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const router = useRouter()

  const selectedStudyLinks = links.filter((l) => l.study_id === selectedStudyId)
  const selectedStudy = studies.find((s) => s.id === selectedStudyId)

  const refresh = useCallback(() => {
    setShowAddForm(false)
    router.refresh()
  }, [router])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Study Links</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Link central regulatory records to studies. No files are duplicated — only references.
        </p>
      </div>

      {/* Study selector */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-600">Select Study</label>
        <div className="mt-1 flex gap-2">
          <select
            value={selectedStudyId}
            onChange={(e) => { setSelectedStudyId(e.target.value); setShowAddForm(false) }}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          >
            <option value="">— Choose a study —</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.status ?? 'no status'})</option>
            ))}
          </select>
          {selectedStudyId && (
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              {showAddForm ? 'Cancel' : 'Add Link'}
            </button>
          )}
        </div>
      </div>

      {/* No study selected */}
      {!selectedStudyId && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-400">Select a study to view its regulatory links</p>
          <p className="mt-1 text-xs text-slate-300">Linked personnel and documents will appear here.</p>
        </div>
      )}

      {/* Add form */}
      {showAddForm && selectedStudyId && (
        <div className="mt-4">
          <AddLinkForm studyId={selectedStudyId} personnel={personnel} documents={documents} onClose={() => setShowAddForm(false)} onSaved={refresh} />
        </div>
      )}

      {/* Links for selected study */}
      {selectedStudyId && selectedStudyLinks.length === 0 && !showAddForm && (
        <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-xs text-slate-400">No regulatory records linked to this study yet.</p>
          <p className="mt-1 text-[10px] text-slate-300">This does not copy documents. Links reference the central master record.</p>
        </div>
      )}

      {selectedStudyLinks.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-600">
              {selectedStudy?.name} — {selectedStudyLinks.length} link{selectedStudyLinks.length !== 1 ? 's' : ''}
            </h3>
          </div>

          {/* Personnel links */}
          {selectedStudyLinks.filter((l) => l.link_type === 'personnel').map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onDeactivate={async () => { await deactivateStudyLink(link.id); router.refresh() }}
              onReactivate={async () => { await reactivateStudyLink(link.id); router.refresh() }}
            />
          ))}

          {/* Document links */}
          {selectedStudyLinks.filter((l) => l.link_type === 'document').map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onDeactivate={async () => { await deactivateStudyLink(link.id); router.refresh() }}
              onReactivate={async () => { await reactivateStudyLink(link.id); router.refresh() }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
