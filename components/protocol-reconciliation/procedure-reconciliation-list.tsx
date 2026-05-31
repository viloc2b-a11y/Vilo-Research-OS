'use client'

import { useState } from 'react'
import type {
  ProcedureMatchSuggestion,
  ProtocolProcedureReconciliationRow,
  ProtocolVisitReconciliationRow,
} from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import { MappingEditor } from './mapping-editor'
import { EvidenceBlock, evidenceSectionLine, formatConfidencePercent, textSnippet } from './evidence-block'
import { ProcedureMatchSuggestionPanel } from './procedure-match-suggestion-panel'

type ProcedureEditForm = {
  procedureName: string
  procedureCategory: string
  required: boolean
  procedureOrder: string
  visitReconciliationId: string
}

function toFormState(procedure: ProtocolProcedureReconciliationRow): ProcedureEditForm {
  return {
    procedureName: procedure.procedureName ?? '',
    procedureCategory: procedure.procedureCategory ?? '',
    required: procedure.required,
    procedureOrder: procedure.procedureOrder == null ? '' : String(procedure.procedureOrder),
    visitReconciliationId: procedure.visitReconciliationId ?? '',
  }
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

export function ProcedureReconciliationCard(props: {
  organizationId: string
  procedure: ProtocolProcedureReconciliationRow
  visits: ProtocolVisitReconciliationRow[]
  onUpdated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProcedureEditForm>(() => toFormState(props.procedure))

  const isApproved = props.procedure.reconciliationStatus === 'approved'
  const isRejected = props.procedure.reconciliationStatus === 'rejected'

  const suggestions =
    (props.procedure.metadata.match_suggestions as ProcedureMatchSuggestion[] | undefined) ?? []

  function startEditing() {
    setForm(toFormState(props.procedure))
    setError(null)
    setEditing(true)
  }

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

  async function saveEdits() {
    if (!form.procedureName.trim()) {
      setError('Procedure name is required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/procedures/${encodeURIComponent(props.procedure.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: props.organizationId,
            procedure_name: form.procedureName.trim(),
            procedure_category: form.procedureCategory.trim() === '' ? null : form.procedureCategory.trim(),
            required: form.required,
            procedure_order: toNullableInt(form.procedureOrder),
            visit_reconciliation_id: form.visitReconciliationId || null,
          }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to update procedure')
      setEditing(false)
      props.onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update procedure')
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

      {editing ? (
        <ProcedureEditFields form={form} disabled={loading} visits={props.visits} onChange={setForm} />
      ) : null}

      <EvidenceBlock
        lines={[
          textSnippet(props.procedure.evidence?.extractedText),
          formatConfidencePercent(props.procedure.evidence?.candidateConfidence, 'Extraction confidence'),
          evidenceSectionLine(
            props.procedure.evidence?.sectionTitle,
            props.procedure.evidence?.sectionType,
          ),
        ]}
      />

      {!editing ? (
        <ProcedureMatchSuggestionPanel
          suggestions={suggestions}
          loading={loading}
          onApply={(suggestion) => void applySuggestion(suggestion)}
        />
      ) : null}

      {editing ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void saveEdits()}
            className="rounded border border-teal-200 bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setEditing(false)
              setError(null)
            }}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      ) : isApproved ? (
        <div className="mt-3 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            Locked
          </span>
          <span className="text-xs text-slate-500">Approved. Reopen/revision required to change.</span>
        </div>
      ) : (
        <>
          {!isRejected ? (
            <MappingEditor
              organizationId={props.organizationId}
              procedureReconciliationId={props.procedure.id}
              selectedProcedureId={props.procedure.matchedProcedureLibraryId ?? ''}
              onSaved={props.onUpdated}
            />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 vilo-hover-reveal opacity-100 md:opacity-0 md:group-hover:opacity-100">
            {!isRejected ? (
              <>
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
              </>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={startEditing}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Edit
            </button>
          </div>
        </>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </li>
  )
}

function ProcedureEditFields(props: {
  form: ProcedureEditForm
  disabled: boolean
  visits: ProtocolVisitReconciliationRow[]
  onChange: (form: ProcedureEditForm) => void
}) {
  const { form, onChange } = props

  function update(patch: Partial<ProcedureEditForm>) {
    onChange({ ...form, ...patch })
  }

  const inputClass =
    'mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50'

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <label className="text-[11px] font-medium text-slate-500">
        Procedure name
        <input
          className={inputClass}
          value={form.procedureName}
          disabled={props.disabled}
          onChange={(e) => update({ procedureName: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Category
        <input
          className={inputClass}
          value={form.procedureCategory}
          disabled={props.disabled}
          onChange={(e) => update({ procedureCategory: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Order
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.procedureOrder}
          disabled={props.disabled}
          onChange={(e) => update({ procedureOrder: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Visit
        <select
          className={inputClass}
          value={form.visitReconciliationId}
          disabled={props.disabled}
          onChange={(e) => update({ visitReconciliationId: e.target.value })}
        >
          <option value="">Unassigned visit</option>
          {props.visits.map((visit) => (
            <option key={visit.id} value={visit.id}>
              {visit.visitCode} · {visit.visitName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <input
          type="checkbox"
          checked={form.required}
          disabled={props.disabled}
          onChange={(e) => update({ required: e.target.checked })}
        />
        Required
      </label>
    </div>
  )
}

export function ProcedureReconciliationList(props: {
  organizationId: string
  procedures: ProtocolProcedureReconciliationRow[]
  visits: ProtocolVisitReconciliationRow[]
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
          visits={props.visits}
          onUpdated={props.onUpdated}
        />
      ))}
    </ul>
  )
}
