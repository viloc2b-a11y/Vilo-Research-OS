'use client'

import { useState } from 'react'
import {
  ObligationAssignmentRow,
  createEmptyObligationDraft,
  obligationDraftToPayload,
  type ObligationDraft,
} from './obligation-assignment-row'
import { OBLIGATION_TYPE } from '@/lib/document-intake/obligation-types'

type ObligationRequestPanelProps = {
  organizationId: string
  documentId: string
  documentLabel: string
  onCreated?: () => void
}

export function ObligationRequestPanel({
  organizationId,
  documentId,
  documentLabel,
  onCreated,
}: ObligationRequestPanelProps) {
  const [drafts, setDrafts] = useState<ObligationDraft[]>([createEmptyObligationDraft()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    const obligations = drafts.map(obligationDraftToPayload)

    try {
      const res = await fetch('/api/document-intake/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          document_id: documentId,
          obligations,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not create obligations')

      setSuccess(true)
      setDrafts([createEmptyObligationDraft()])
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create obligations')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-indigo-100 bg-indigo-50/40 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">Request follow-up actions</h3>
      <p className="mt-1 text-sm text-slate-600">
        For <span className="font-medium">{documentLabel}</span>. An immutable audit trail will be
        recorded for each request.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? (
        <p className="mt-3 text-sm text-green-700">Obligations created. Assignees can complete them below.</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {drafts.map((draft) => (
          <ObligationAssignmentRow
            key={draft.key}
            draft={draft}
            onChange={(next) =>
              setDrafts((rows) => rows.map((row) => (row.key === draft.key ? next : row)))
            }
            onRemove={() => setDrafts((rows) => rows.filter((row) => row.key !== draft.key))}
          />
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            onClick={() => setDrafts((rows) => [...rows, createEmptyObligationDraft(OBLIGATION_TYPE.SIGNATURE)])}
          >
            + Request signature
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            onClick={() =>
              setDrafts((rows) => [...rows, createEmptyObligationDraft(OBLIGATION_TYPE.ACKNOWLEDGEMENT)])
            }
          >
            + Request acknowledgement
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting || drafts.length === 0}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? 'Creating requests…' : 'Create obligation requests'}
        </button>
      </form>
    </div>
  )
}
