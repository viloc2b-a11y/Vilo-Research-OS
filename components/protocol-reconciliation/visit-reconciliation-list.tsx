'use client'

import { useState } from 'react'
import type { ProtocolVisitReconciliationRow } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import { EvidenceBlock, evidenceSectionLine, formatConfidencePercent, textSnippet } from './evidence-block'

type VisitEditForm = {
  visitCode: string
  visitName: string
  visitType: string
  studyDay: string
  windowBefore: string
  windowAfter: string
}

function toFormState(visit: ProtocolVisitReconciliationRow): VisitEditForm {
  return {
    visitCode: visit.visitCode ?? '',
    visitName: visit.visitName ?? '',
    visitType: visit.visitType ?? '',
    studyDay: visit.studyDay == null ? '' : String(visit.studyDay),
    windowBefore: visit.windowBeforeDays == null ? '' : String(visit.windowBeforeDays),
    windowAfter: visit.windowAfterDays == null ? '' : String(visit.windowAfterDays),
  }
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

export function VisitReconciliationCard(props: {
  organizationId: string
  visit: ProtocolVisitReconciliationRow
  onUpdated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<VisitEditForm>(() => toFormState(props.visit))

  const isApproved = props.visit.reconciliationStatus === 'approved'
  const isRejected = props.visit.reconciliationStatus === 'rejected'

  function startEditing() {
    setForm(toFormState(props.visit))
    setError(null)
    setEditing(true)
  }

  async function postAction(path: 'approve' | 'reject') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/visits/${encodeURIComponent(props.visit.id)}/${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: props.organizationId }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || `Failed to ${path} visit`)
      props.onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${path} visit`)
    } finally {
      setLoading(false)
    }
  }

  async function saveEdits() {
    if (!form.visitCode.trim() || !form.visitName.trim()) {
      setError('Visit code and visit name are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/visits/${encodeURIComponent(props.visit.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: props.organizationId,
            visit_code: form.visitCode.trim(),
            visit_name: form.visitName.trim(),
            visit_type: form.visitType.trim() === '' ? null : form.visitType.trim(),
            study_day: toNullableInt(form.studyDay),
            window_before_days: toNullableInt(form.windowBefore),
            window_after_days: toNullableInt(form.windowAfter),
          }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to update visit')
      setEditing(false)
      props.onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="group rounded border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">
          {props.visit.visitCode} · {props.visit.visitName}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {props.visit.reconciliationStatus}
        </span>
        <span className="text-xs text-slate-500">{props.visit.reconciliationSource}</span>
      </div>

      {editing ? (
        <VisitEditFields form={form} disabled={loading} onChange={setForm} />
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          {props.visit.visitType ? `${props.visit.visitType} · ` : ''}Day {props.visit.studyDay ?? '—'} ·
          window −{props.visit.windowBeforeDays ?? '—'} / +{props.visit.windowAfterDays ?? '—'}
        </p>
      )}

      <EvidenceBlock
        lines={[
          evidenceSectionLine(props.visit.evidence?.sectionTitle, props.visit.evidence?.sectionType),
          textSnippet(props.visit.evidence?.extractedText),
          formatConfidencePercent(props.visit.evidence?.candidateConfidence, 'Extraction confidence'),
        ]}
      />

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
      ) : !isApproved ? (
        <div className="mt-3 flex flex-wrap gap-2 vilo-hover-reveal opacity-100 md:opacity-0 md:group-hover:opacity-100">
          {!isRejected ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => void postAction('approve')}
                className="rounded border border-teal-200 px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
              >
                Approve visit
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
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            Locked
          </span>
          <span className="text-xs text-slate-500">Approved. Reopen/revision required to change.</span>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </li>
  )
}

function VisitEditFields(props: {
  form: VisitEditForm
  disabled: boolean
  onChange: (form: VisitEditForm) => void
}) {
  const { form, onChange } = props

  function update(patch: Partial<VisitEditForm>) {
    onChange({ ...form, ...patch })
  }

  const inputClass =
    'mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50'

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <label className="text-[11px] font-medium text-slate-500">
        Visit code
        <input
          className={inputClass}
          value={form.visitCode}
          disabled={props.disabled}
          onChange={(e) => update({ visitCode: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Visit name
        <input
          className={inputClass}
          value={form.visitName}
          disabled={props.disabled}
          onChange={(e) => update({ visitName: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Visit type
        <input
          className={inputClass}
          value={form.visitType}
          disabled={props.disabled}
          onChange={(e) => update({ visitType: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Study day
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.studyDay}
          disabled={props.disabled}
          onChange={(e) => update({ studyDay: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Window before (days)
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.windowBefore}
          disabled={props.disabled}
          onChange={(e) => update({ windowBefore: e.target.value })}
        />
      </label>
      <label className="text-[11px] font-medium text-slate-500">
        Window after (days)
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.windowAfter}
          disabled={props.disabled}
          onChange={(e) => update({ windowAfter: e.target.value })}
        />
      </label>
    </div>
  )
}

export function VisitReconciliationList(props: {
  organizationId: string
  visits: ProtocolVisitReconciliationRow[]
  onUpdated: () => void
}) {
  if (props.visits.length === 0) {
    return <p className="text-sm text-slate-500">No visit reconciliations yet. Initialize from candidates.</p>
  }
  return (
    <ul className="space-y-2">
      {props.visits.map((visit) => (
        <VisitReconciliationCard
          key={visit.id}
          organizationId={props.organizationId}
          visit={visit}
          onUpdated={props.onUpdated}
        />
      ))}
    </ul>
  )
}
