// components/subject/clinical-profile/SurgicalHistorySection.tsx
'use client'

import { useState, useTransition } from 'react'
import { Plus, Scissors, Pencil, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { addSurgicalHistory, updateSurgicalHistory, verifyProfileEntry } from '@/lib/subject/clinical-profile/actions'
import type { SubjectSurgicalHistory, SurgicalHistoryInput } from '@/lib/subject/clinical-profile/types'

const DATE_PRECISION_LABELS: Record<string, string> = {
  exact: 'Exact date',
  month: 'Month/Year',
  year: 'Year only',
  decade: 'Decade',
  unknown: 'Unknown',
}

type FormState = {
  procedure_name: string
  approximate_date: string
  date_precision: string
  outcome: string
  source_attribution: string
  comments: string
}

const EMPTY_FORM: FormState = {
  procedure_name: '',
  approximate_date: '',
  date_precision: 'exact',
  outcome: '',
  source_attribution: '',
  comments: '',
}

type SurgicalHistorySectionProps = {
  studySubjectId: string
  rows: SubjectSurgicalHistory[]
  canVerify?: boolean
  actorRole?: string
}

export function SurgicalHistorySection({ studySubjectId, rows, canVerify = false, actorRole = 'coordinator' }: SurgicalHistorySectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(row: SubjectSurgicalHistory) {
    setEditingId(row.surgical_history_id)
    setForm({
      procedure_name: row.procedure_name,
      approximate_date: row.approximate_date ?? '',
      date_precision: row.date_precision,
      outcome: row.outcome ?? '',
      source_attribution: row.source_attribution ?? '',
      comments: row.comments ?? '',
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function handleSubmit() {
    if (!form.procedure_name.trim()) { setError('Procedure name is required.'); return }
    if (!form.source_attribution.trim()) { setError('Source attribution is required.'); return }
    if (editingId && !changeReason.trim()) { setError('Reason for change is required.'); return }

    const input: SurgicalHistoryInput = {
      procedure_name: form.procedure_name.trim(),
      approximate_date: form.approximate_date || null,
      date_precision: (form.date_precision as SurgicalHistoryInput['date_precision']) ?? 'exact',
      outcome: form.outcome || null,
      source_attribution: form.source_attribution.trim(),
      comments: form.comments || null,
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateSurgicalHistory(editingId, studySubjectId, { ...input, change_reason: changeReason })
        } else {
          await addSurgicalHistory(studySubjectId, input)
        }
        setShowForm(false)
        setForm(EMPTY_FORM)
        setEditingId(null)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Surgical & Procedure History</h3>
          <p className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'procedure' : 'procedures'} documented
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add procedure
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-medium">
            {editingId ? 'Edit surgical history entry' : 'New surgical history entry'}
          </h4>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="surgery-name" className="text-xs">Procedure name *</Label>
              <Input
                id="surgery-name"
                value={form.procedure_name}
                onChange={(e) => setForm({ ...form, procedure_name: e.target.value })}
                placeholder="e.g. Appendectomy, Knee replacement, CABG"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="surgery-date" className="text-xs">Approximate date</Label>
              <Input
                id="surgery-date"
                type="date"
                value={form.approximate_date}
                onChange={(e) => setForm({ ...form, approximate_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="surgery-precision" className="text-xs">Date precision</Label>
              <Select
                value={form.date_precision}
                onValueChange={(v) => setForm({ ...form, date_precision: v })}
              >
                <SelectTrigger id="surgery-precision">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DATE_PRECISION_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="surgery-outcome" className="text-xs">Outcome / notes</Label>
              <Input
                id="surgery-outcome"
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                placeholder="e.g. Uncomplicated, Successful, Complications noted"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="surgery-source" className="text-xs">Source attribution *</Label>
              <Input
                id="surgery-source"
                value={form.source_attribution}
                onChange={(e) => setForm({ ...form, source_attribution: e.target.value })}
                placeholder="e.g. Subject-reported at screening, Prior medical records"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="surgery-comments" className="text-xs">Additional comments</Label>
              <Textarea
                id="surgery-comments"
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                rows={2}
                placeholder="Optional additional notes"
              />
            </div>

            {editingId && (
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="surgery-change-reason" className="text-xs">Reason for change *</Label>
                <Input
                  id="surgery-change-reason"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Required for edits (ALCOA+)"
                />
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">No surgical history documented.</p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.surgical_history_id}
            className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-sm"
          >
            <div className="flex items-start gap-2 min-w-0">
              <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium truncate">{row.procedure_name}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {row.approximate_date && (
                    <span>
                      {row.approximate_date}
                      {row.date_precision !== 'exact' && (
                        <span className="ml-1 text-muted-foreground/60">
                          ({DATE_PRECISION_LABELS[row.date_precision]})
                        </span>
                      )}
                    </span>
                  )}
                  {row.outcome && <span>· {row.outcome}</span>}
                </div>
                {row.source_attribution && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Source: {row.source_attribution}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 items-center">
              {canVerify && !row.verified_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-blue-600 hover:text-blue-700"
                  title="Verify entry (PI/QA)"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await verifyProfileEntry('surgical_history', row.surgical_history_id, studySubjectId, actorRole)
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Verify failed')
                      }
                    })
                  }}
                >
                  <ShieldCheck className="h-3 w-3" />
                </Button>
              ) : null}
              {row.verified_at ? (
                <span title={`Verified ${new Date(row.verified_at).toLocaleDateString()}`}>
                  <ShieldCheck className="h-3 w-3 text-green-600" />
                </span>
              ) : null}
              <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => openEdit(row)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
