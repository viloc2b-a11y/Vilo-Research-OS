'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProtocolDeviationRow } from '@/lib/protocol-deviations/deviation-types'

const DEVIATION_TYPE_LABELS: Record<string, string> = {
  missed_visit: 'Missed Visit',
  visit_window_violation: 'Visit Window Violation',
  missed_procedure: 'Missed Procedure',
  delayed_procedure: 'Delayed Procedure',
  subject_noncompliance: 'Subject Non-Compliance',
  protocol_exception: 'Protocol Exception',
  sponsor_directed: 'Sponsor Directed',
  other: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  closed: 'bg-green-50 text-green-700 border-green-200',
}

const SEVERITY_STYLES: Record<string, string> = {
  minor: 'text-green-700',
  major: 'text-yellow-700',
  critical: 'text-red-700',
}

const DEVIATION_TYPE_OPTIONS = [
  { value: 'missed_visit', label: 'Missed Visit' },
  { value: 'visit_window_violation', label: 'Visit Window Violation' },
  { value: 'missed_procedure', label: 'Missed Procedure' },
  { value: 'delayed_procedure', label: 'Delayed Procedure' },
  { value: 'subject_noncompliance', label: 'Subject Non-Compliance' },
  { value: 'protocol_exception', label: 'Protocol Exception' },
  { value: 'sponsor_directed', label: 'Sponsor Directed' },
  { value: 'other', label: 'Other' },
]

function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

const CREATE_FORM_DEFAULTS = {
  deviationType: 'missed_visit',
  severity: 'minor',
  description: '',
  rootCause: '',
  correctiveAction: '',
  preventiveAction: '',
  requiresSponsorNotification: false,
  requiresIrbNotification: false,
}

type SubjectProtocolDeviationsTimelineProps = {
  deviations: ProtocolDeviationRow[]
  canManageDeviations: boolean
  organizationId: string
  studyId: string
  subjectId: string
}

export function SubjectProtocolDeviationsTimeline({
  deviations,
  canManageDeviations,
  organizationId,
  studyId,
  subjectId,
}: SubjectProtocolDeviationsTimelineProps) {
  const router = useRouter()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    deviationType: string
    severity: string
    description: string
    rootCause: string
    correctiveAction: string
    preventiveAction: string
    requiresSponsorNotification: boolean
    requiresIrbNotification: boolean
  }>(CREATE_FORM_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(CREATE_FORM_DEFAULTS)
  const [creating, setCreating] = useState(false)

  function startEdit(deviation: ProtocolDeviationRow) {
    setEditingId(deviation.id)
    setEditForm({
      deviationType: deviation.deviationType,
      severity: deviation.severity,
      description: deviation.description,
      rootCause: deviation.rootCause ?? '',
      correctiveAction: deviation.correctiveAction ?? '',
      preventiveAction: deviation.preventiveAction ?? '',
      requiresSponsorNotification: deviation.requiresSponsorNotification,
      requiresIrbNotification: deviation.requiresIrbNotification,
    })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit(deviationId: string) {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/protocol-deviations/${deviationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          deviation_type: editForm.deviationType,
          severity: editForm.severity,
          description: editForm.description,
          root_cause: editForm.rootCause || null,
          corrective_action: editForm.correctiveAction || null,
          preventive_action: editForm.preventiveAction || null,
          requires_sponsor_notification: editForm.requiresSponsorNotification,
          requires_irb_notification: editForm.requiresIrbNotification,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update protocol deviation')

      setEditingId(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update protocol deviation')
    } finally {
      setSaving(false)
    }
  }

  async function closeDeviation(deviationId: string) {
    setClosingId(deviationId)
    setError(null)

    try {
      const res = await fetch(`/api/protocol-deviations/${deviationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          status: 'closed',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to close protocol deviation')

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close protocol deviation')
    } finally {
      setClosingId(null)
    }
  }

  async function submitCreate() {
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/protocol-deviations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          subject_id: subjectId,
          deviation_type: createForm.deviationType,
          severity: createForm.severity,
          description: createForm.description,
          root_cause: createForm.rootCause || null,
          corrective_action: createForm.correctiveAction || null,
          preventive_action: createForm.preventiveAction || null,
          requires_sponsor_notification: createForm.requiresSponsorNotification,
          requires_irb_notification: createForm.requiresIrbNotification,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create protocol deviation')

      setShowCreate(false)
      setCreateForm(CREATE_FORM_DEFAULTS)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create protocol deviation')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Protocol Deviations</h2>
          <p className="text-sm text-muted-foreground">Tracked protocol deviations for this subject.</p>
        </div>
        {canManageDeviations ? (
          <button
            onClick={() => { setShowCreate(true); setError(null) }}
            className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Deviation
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      {/* Create form */}
      {showCreate ? (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
          <h3 className="text-sm font-semibold">New Protocol Deviation</h3>
          <DeviationFormFields
            form={createForm}
            setForm={setCreateForm}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowCreate(false); setError(null) }}
              disabled={creating}
              className="h-7 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={creating || !createForm.description}
              className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Deviation list */}
      {deviations.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">No protocol deviations</p>
          <p className="text-xs text-muted-foreground mt-1">
            No deviations recorded for this subject.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {deviations.map((deviation) => {
            const isEditing = editingId === deviation.id
            const isClosed = deviation.status === 'closed'

            return (
              <div
                key={deviation.id}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {DEVIATION_TYPE_LABELS[deviation.deviationType] ?? deviation.deviationType}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[deviation.status] ?? ''}`}>
                      {deviation.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-medium ${SEVERITY_STYLES[deviation.severity] ?? 'text-muted-foreground'}`}>
                      {deviation.severity.charAt(0).toUpperCase() + deviation.severity.slice(1)}
                    </span>
                    {deviation.requiresSponsorNotification ? (
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                        Sponsor Notify
                      </span>
                    ) : null}
                    {deviation.requiresIrbNotification ? (
                      <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        IRB Notify
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Body */}
                {isEditing ? (
                  <div className="space-y-3">
                    <DeviationFormFields
                      form={editForm}
                      setForm={setEditForm}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="h-7 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(deviation.id)}
                        disabled={saving}
                        className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deviation.description ? (
                      <p className="text-xs text-foreground">{deviation.description}</p>
                    ) : null}

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      {deviation.rootCause ? (
                        <div>
                          <span className="font-medium text-foreground">Root Cause:</span>{' '}
                          {deviation.rootCause}
                        </div>
                      ) : null}
                      {deviation.correctiveAction ? (
                        <div>
                          <span className="font-medium text-foreground">Corrective Action:</span>{' '}
                          {deviation.correctiveAction}
                        </div>
                      ) : null}
                      {deviation.preventiveAction ? (
                        <div>
                          <span className="font-medium text-foreground">Preventive Action:</span>{' '}
                          {deviation.preventiveAction}
                        </div>
                      ) : null}
                      <div>
                        <span className="font-medium text-foreground">Opened:</span>{' '}
                        {formatDate(deviation.openedAt)}
                      </div>
                      {deviation.closedAt ? (
                        <div>
                          <span className="font-medium text-foreground">Closed:</span>{' '}
                          {formatDate(deviation.closedAt)}
                        </div>
                      ) : null}
                    </div>

                    {/* Action buttons */}
                    {canManageDeviations && !isClosed ? (
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <button
                          onClick={() => startEdit(deviation)}
                          className="h-6 rounded-md border border-input bg-background px-2 text-[10px] font-medium text-foreground hover:bg-accent"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => closeDeviation(deviation.id)}
                          disabled={closingId === deviation.id}
                          className="h-6 rounded-md border border-green-300 bg-green-50 px-2 text-[10px] font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {closingId === deviation.id ? 'Closing...' : 'Close'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DeviationFormFields({
  form,
  setForm,
}: {
  form: {
    deviationType: string
    severity: string
    description: string
    rootCause: string
    correctiveAction: string
    preventiveAction: string
    requiresSponsorNotification: boolean
    requiresIrbNotification: boolean
  }
  setForm: (f: typeof form) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Deviation Type</label>
          <select
            value={form.deviationType}
            onChange={(e) => setForm({ ...form, deviationType: e.target.value })}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {DEVIATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Severity</label>
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Root Cause</label>
        <textarea
          value={form.rootCause}
          onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
          rows={1}
          className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Corrective Action</label>
          <textarea
            value={form.correctiveAction}
            onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            rows={1}
            className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Preventive Action</label>
          <textarea
            value={form.preventiveAction}
            onChange={(e) => setForm({ ...form, preventiveAction: e.target.value })}
            rows={1}
            className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.requiresSponsorNotification}
            onChange={(e) => setForm({ ...form, requiresSponsorNotification: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs font-medium text-muted-foreground">Sponsor Notification Required</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.requiresIrbNotification}
            onChange={(e) => setForm({ ...form, requiresIrbNotification: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs font-medium text-muted-foreground">IRB Notification Required</span>
        </label>
      </div>
    </div>
  )
}
