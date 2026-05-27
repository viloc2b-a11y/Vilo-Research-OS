'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SourceBlueprintEvidenceRow } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import type { SourceBlueprintEvidenceReviewEventRow } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import { EVIDENCE_KIND_LABELS } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import type { SourceBlueprintEvidenceLineageRow } from '@/lib/source-blueprint-evidence/source-lineage-types'
import type { TraceOrigin } from '@/lib/source-blueprint-evidence/source-lineage-types'
import { EvidenceProvenanceTrace } from './evidence-provenance-trace'
import { EvidenceLineageMapping, type LineageDraft } from './evidence-lineage-mapping'

type ProcedureOption = {
  id: string
  displayName: string
  latestPublishedVersionId: string | null
}

type EvidenceDetailPanelProps = {
  organizationId: string
  studyId: string
  evidenceId: string | null
  refreshKey: number
  onReviewed: () => void
}

export function EvidenceDetailPanel({
  organizationId,
  studyId,
  evidenceId,
  refreshKey,
  onReviewed,
}: EvidenceDetailPanelProps) {
  const [evidence, setEvidence] = useState<SourceBlueprintEvidenceRow | null>(null)
  const [lineage, setLineage] = useState<SourceBlueprintEvidenceLineageRow[]>([])
  const [suggestedTraceOrigin, setSuggestedTraceOrigin] = useState<TraceOrigin>('sop_manual_evidence')
  const [lineageDrafts, setLineageDrafts] = useState<LineageDraft[]>([])
  const [events, setEvents] = useState<SourceBlueprintEvidenceReviewEventRow[]>([])
  const [procedures, setProcedures] = useState<ProcedureOption[]>([])
  const [procedureId, setProcedureId] = useState('')
  const [blueprintVersionId, setBlueprintVersionId] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLineageChange = useCallback((drafts: LineageDraft[]) => {
    setLineageDrafts(drafts)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!evidenceId) {
        setEvidence(null)
        setLineage([])
        setEvents([])
        return
      }
      setLoading(true)
      try {
        const base = `/api/source-blueprint-evidence/${encodeURIComponent(evidenceId)}`
        const q = `organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`
        const [evRes, evEventsRes] = await Promise.all([
          fetch(`${base}?${q}`),
          fetch(`${base}/events?${q}`),
        ])
        const evData = (await evRes.json()) as {
          evidence?: SourceBlueprintEvidenceRow
          lineage?: SourceBlueprintEvidenceLineageRow[]
          suggestedTraceOrigin?: TraceOrigin
          error?: string
        }
        const eventsData = (await evEventsRes.json()) as {
          events?: SourceBlueprintEvidenceReviewEventRow[]
        }
        if (!evRes.ok) throw new Error(evData.error || 'Failed to load evidence')
        if (!cancelled) {
          setEvidence(evData.evidence ?? null)
          setLineage(evData.lineage ?? [])
          setSuggestedTraceOrigin(evData.suggestedTraceOrigin ?? 'sop_manual_evidence')
          setEvents(eventsData.events ?? [])
          setReviewNotes(evData.evidence?.mappingNotes ?? '')
          setProcedureId(evData.evidence?.mappedProcedureLibraryId ?? '')
          setBlueprintVersionId(evData.evidence?.mappedBlueprintVersionId ?? '')
        }
      } catch (err) {
        if (!cancelled) {
          setEvidence(null)
          setError(err instanceof Error ? err.message : 'Load failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, evidenceId, refreshKey])

  useEffect(() => {
    let cancelled = false
    async function loadProcedures() {
      try {
        const res = await fetch(
          `/api/procedure-library?organization_id=${encodeURIComponent(organizationId)}&library_scope=all`,
        )
        const data = (await res.json()) as {
          procedures?: Array<{
            id: string
            displayName: string
            latestPublishedVersionId: string | null
          }>
        }
        if (!cancelled) {
          const options = (data.procedures ?? [])
            .filter((p) => p.latestPublishedVersionId)
            .map((p) => ({
              id: p.id,
              displayName: p.displayName,
              latestPublishedVersionId: p.latestPublishedVersionId,
            }))
          setProcedures(options)
        }
      } catch {
        if (!cancelled) setProcedures([])
      }
    }
    void loadProcedures()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  async function runAction(action: 'accept' | 'reject' | 'map') {
    if (!evidenceId) return
    setActionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const base = `/api/source-blueprint-evidence/${encodeURIComponent(evidenceId)}/${action}`
      const body: Record<string, unknown> = {
        organization_id: organizationId,
        study_id: studyId,
        review_notes: reviewNotes || null,
      }
      if (action === 'map') {
        if (!procedureId || !blueprintVersionId) {
          throw new Error('Select a procedure library entry with a published blueprint.')
        }
        body.mapped_procedure_library_id = procedureId
        body.mapped_blueprint_version_id = blueprintVersionId
        body.lineage = lineageDrafts.map((draft) => ({
          element_type: draft.elementType,
          element_key: draft.elementKey,
          element_label: draft.elementLabel,
          trace_origin: draft.traceOrigin,
        }))
      }
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || `${action} failed`)
      setMessage(
        action === 'map'
          ? 'Evidence mapping saved. Blueprint and source changes require separate manual workflows.'
          : `Evidence ${action}ed successfully.`,
      )
      onReviewed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (!evidenceId) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
        Select an evidence item for Evidence Review and Provenance Trace.
      </div>
    )
  }

  if (loading) return <p className="text-sm text-slate-500">Loading evidence detail…</p>
  if (!evidence) return <p className="text-sm text-red-600">{error || 'Evidence not found.'}</p>

  const needsReview = evidence.evidenceStatus === 'pending_review'
  const canAccept = needsReview
  const canReject =
    evidence.evidenceStatus !== 'rejected' &&
    evidence.evidenceStatus !== 'mapped' &&
    evidence.evidenceStatus !== 'archived' &&
    evidence.evidenceStatus !== 'superseded'
  const canMap =
    evidence.evidenceStatus === 'accepted' || evidence.evidenceStatus === 'mapped'

  return (
    <div className="vilo-scroll-contained max-h-[80vh] space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="group">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">{evidence.title}</h2>
          {needsReview ? (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Coordinator Review Required
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {EVIDENCE_KIND_LABELS[evidence.evidenceKind]} · {evidence.evidenceStatus} ·{' '}
          {evidence.usageDomain}
        </p>
      </div>

      <EvidenceProvenanceTrace evidence={evidence} studyId={studyId} lineage={lineage} />

      <section>
        <h3 className="text-xs font-medium text-slate-700">Excerpt</h3>
        <p className="mt-1 max-h-40 overflow-y-auto text-sm text-slate-700">{evidence.excerptText}</p>
      </section>

      {Object.keys(evidence.structuredPayload).length > 0 ? (
        <section>
          <h3 className="text-xs font-medium text-slate-700">Structured hints</h3>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
            {JSON.stringify(evidence.structuredPayload, null, 2)}
          </pre>
        </section>
      ) : null}

      <section>
        <label className="text-xs font-medium text-slate-700">
          Review notes
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            rows={2}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </label>
      </section>

      {canMap ? (
        <section className="space-y-3 rounded border border-slate-200 p-3">
          <h3 className="text-xs font-semibold text-slate-800">Map Evidence</h3>
          <label className="block text-xs text-slate-600">
            Procedure library
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={procedureId}
              onChange={(e) => {
                const nextId = e.target.value
                setProcedureId(nextId)
                const proc = procedures.find((p) => p.id === nextId)
                if (proc?.latestPublishedVersionId) {
                  setBlueprintVersionId(proc.latestPublishedVersionId)
                }
              }}
            >
              <option value="">Select procedure…</option>
              {procedures.map((proc) => (
                <option key={proc.id} value={proc.id}>
                  {proc.displayName}
                </option>
              ))}
            </select>
          </label>
          {blueprintVersionId ? (
            <p className="text-xs text-slate-500">
              Blueprint version: {blueprintVersionId.slice(0, 8)}…
            </p>
          ) : null}
          <EvidenceLineageMapping
            key={`${evidenceId}-${refreshKey}-${blueprintVersionId}`}
            organizationId={organizationId}
            studyId={studyId}
            blueprintVersionId={blueprintVersionId}
            suggestedTraceOrigin={suggestedTraceOrigin}
            existingLineage={lineage}
            disabled={actionLoading}
            onChange={handleLineageChange}
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            disabled={actionLoading || !procedureId}
            onClick={() => void runAction('map')}
          >
            {actionLoading ? 'Saving…' : 'Save evidence mapping'}
          </button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canAccept ? (
          <button
            type="button"
            className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={actionLoading}
            onClick={() => void runAction('accept')}
          >
            Accept
          </button>
        ) : null}
        {canReject ? (
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
            disabled={actionLoading}
            onClick={() => void runAction('reject')}
          >
            Reject
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section>
        <h3 className="text-xs font-medium text-slate-700">Review audit trail</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {events.map((event) => (
            <li key={event.id}>
              {event.eventType} · {new Date(event.eventTimestamp).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
