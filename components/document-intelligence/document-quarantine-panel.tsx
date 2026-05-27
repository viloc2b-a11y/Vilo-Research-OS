'use client'

import { useState } from 'react'

type DocumentQuarantinePanelProps = {
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  quarantineReason: Record<string, unknown>
  ingestionRunId?: string | null
  onReleased: () => void
}

export function DocumentQuarantinePanel({
  organizationId,
  studyId,
  intelligenceDocumentId,
  quarantineReason,
  ingestionRunId,
  onReleased,
}: DocumentQuarantinePanelProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleRelease() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/document-intelligence/documents/${encodeURIComponent(intelligenceDocumentId)}/release-quarantine`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            study_id: studyId,
            ingestion_run_id: ingestionRunId,
            override_notes: notes,
          }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Override failed')
      setMessage('PHI override recorded. Ingestion will continue indexing.')
      onReleased()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed')
    } finally {
      setLoading(false)
    }
  }

  const riskScore =
    typeof quarantineReason.risk_score === 'number' ? quarantineReason.risk_score : null

  return (
    <section className="mt-4 rounded border border-amber-200 bg-amber-50/80 p-3">
      <h3 className="text-xs font-semibold text-amber-900">PHI quarantine</h3>
      <p className="mt-1 text-xs text-amber-800">
        Pre-ingest scan flagged potential PHI. This document is not searchable and cannot be used
        for evidence extraction until a coordinator reviews and overrides with notes. No runtime
        or published source changes occur.
      </p>
      {riskScore != null ? (
        <p className="mt-2 text-xs text-amber-700">Risk score: {riskScore.toFixed(2)}</p>
      ) : null}
      <label className="mt-3 block text-xs font-medium text-amber-900">
        Coordinator override notes (required)
        <textarea
          className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-800"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Documented reason for proceeding after PHI review…"
        />
      </label>
      <button
        type="button"
        className="mt-2 rounded border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
        disabled={loading || notes.trim().length < 10}
        onClick={() => void handleRelease()}
      >
        {loading ? 'Releasing…' : 'Release quarantine and continue ingest'}
      </button>
      {message ? <p className="mt-2 text-xs text-teal-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  )
}
