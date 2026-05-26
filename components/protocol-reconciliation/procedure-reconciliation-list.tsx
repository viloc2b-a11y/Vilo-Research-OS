'use client'

import { useState } from 'react'
import type {
  ProcedureMatchSuggestion,
  ProtocolProcedureReconciliationRow,
} from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import { MappingEditor } from './mapping-editor'
import { ProcedureMatchSuggestionPanel } from './procedure-match-suggestion-panel'

export function ProcedureReconciliationCard(props: {
  organizationId: string
  procedure: ProtocolProcedureReconciliationRow
  onUpdated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestions =
    (props.procedure.metadata.match_suggestions as ProcedureMatchSuggestion[] | undefined) ?? []

  async function postAction(path: 'approve' | 'reject') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/procedures/${encodeURIComponent(props.procedure.id)}/${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: props.organizationId }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || `Failed to ${path} procedure`)
      props.onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${path} procedure`)
    } finally {
      setLoading(false)
    }
  }

  async function applySuggestion(suggestion: ProcedureMatchSuggestion) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/procedures/${encodeURIComponent(props.procedure.id)}/mapping`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: props.organizationId,
            matched_procedure_library_id: suggestion.procedureId,
            matched_blueprint_version_id: suggestion.blueprintVersionId,
          }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to apply suggestion')
      props.onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="group rounded border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{props.procedure.procedureName}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {props.procedure.reconciliationStatus}
        </span>
        <span className="text-xs text-slate-500">{props.procedure.matchingMethod}</span>
        {props.procedure.matchConfidence != null ? (
          <span className="text-xs text-slate-500">
            {Math.round(props.procedure.matchConfidence * 100)}% confidence
          </span>
        ) : null}
      </div>
      {props.procedure.matchedProcedureLibraryId ? (
        <p className="mt-1 text-xs text-teal-800">Blueprint linked · {props.procedure.matchedProcedureLibraryId.slice(0, 8)}…</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">No blueprint mapping</p>
      )}

      <ProcedureMatchSuggestionPanel
        suggestions={suggestions}
        loading={loading}
        onApply={(suggestion) => void applySuggestion(suggestion)}
      />

      {props.procedure.reconciliationStatus !== 'approved' && props.procedure.reconciliationStatus !== 'rejected' ? (
        <>
          <MappingEditor
            organizationId={props.organizationId}
            procedureReconciliationId={props.procedure.id}
            selectedProcedureId={props.procedure.matchedProcedureLibraryId ?? ''}
            onSaved={props.onUpdated}
          />
          <div className="mt-3 flex flex-wrap gap-2 vilo-hover-reveal opacity-100 md:opacity-0 md:group-hover:opacity-100">
            <button
              type="button"
              disabled={loading}
              onClick={() => void postAction('approve')}
              className="rounded border border-teal-200 px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
            >
              Approve mapping
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void postAction('reject')}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              Reject
            </button>
          </div>
        </>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </li>
  )
}

export function ProcedureReconciliationList(props: {
  organizationId: string
  procedures: ProtocolProcedureReconciliationRow[]
  onUpdated: () => void
}) {
  if (props.procedures.length === 0) {
    return <p className="text-sm text-slate-500">No procedure reconciliations yet.</p>
  }
  return (
    <ul className="space-y-2">
      {props.procedures.map((procedure) => (
        <ProcedureReconciliationCard
          key={procedure.id}
          organizationId={props.organizationId}
          procedure={procedure}
          onUpdated={props.onUpdated}
        />
      ))}
    </ul>
  )
}
