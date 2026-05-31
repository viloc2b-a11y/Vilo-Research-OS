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
import { Checkbox } from '@/components/ui/checkbox'
import { SurgicalProcedureCombobox } from '@/components/subject/clinical-profile/LibrarySearchCombobox'
import { addSurgicalHistory, updateSurgicalHistory, verifyProfileEntry } from '@/lib/subject/clinical-profile/actions'
import type { SubjectSurgicalHistory, SurgicalHistoryInput } from '@/lib/subject/clinical-profile/types'
import type { SurgicalProcedureResult } from '@/lib/subject/clinical-profile/library-search-types'

const DATE_PRECISION_LABELS: Record<string, string> = {
  exact: 'Exact date',
  month: 'Month/Year',
  year: 'Year only',
  decade: 'Decade',
  unknown: 'Unknown',
}

type FormState = {
  surgical_procedure_library_id: string
  procedure_code: string
  procedure_source_library: string
  free_text_override: boolean
  procedure_name: string
  approximate_date: string
  stop_date: string
  ongoing: boolean
  complication_ongoing: boolean
  date_precision: string
  outcome: string
  complications: string
  source_attribution: string
  comments: string
}

const EMPTY_FORM: FormState = {
  surgical_procedure_library_id: '',
  procedure_code: '',
  procedure_source_library: '',
  free_text_override: false,
  procedure_name: '',
  approximate_date: '',
  stop_date: '',
  ongoing: false,
  complication_ongoing: false,
  date_precision: 'exact',
  outcome: '',
  complications: '',
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
      surgical_procedure_library_id: row.surgical_procedure_library_id ?? '',
      procedure_code: row.procedure_code ?? '',
      procedure_source_library: row.procedure_source_library ?? '',
      free_text_override: row.free_text_override,
      procedure_name: row.procedure_name,
      approximate_date: row.approximate_date ?? '',
      stop_date: row.stop_date ?? '',
      ongoing: row.ongoing,
      complication_ongoing: row.complication_ongoing,
      date_precision: row.date_precision,
      outcome: row.outcome ?? '',
      complications: row.complications ?? '',
      source_attribution: row.source_attribution ?? '',
      comments: row.comments ?? '',
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function handleSubmit() {
    if (!form.procedure_name.trim()) { setError('Procedure is required. Select a library term or use Other / Unlisted.'); return }
    if (!form.source_attribution.trim()) { setError('Source attribution is required.'); return }
    if (form.ongoing && form.stop_date) { setError('Stop Date must be empty when Ongoing is selected.'); return }
    if (!form.ongoing && form.complication_ongoing && !form.stop_date) { setError('Stop Date is required when ongoing complications are no longer active.'); return }
    if (editingId && !changeReason.trim()) { setError('Reason for change is required.'); return }

    const input: SurgicalHistoryInput = {
      surgical_procedure_library_id: form.free_text_override ? null : form.surgical_procedure_library_id || null,
      procedure_code: form.free_text_override ? null : form.procedure_code || null,
      procedure_source_library: form.free_text_override ? 'UNLISTED' : form.procedure_source_library || 'surgical_procedure_library',
      free_text_override: form.free_text_override,
      procedure_name: form.procedure_name.trim(),
      approximate_date: form.approximate_date || null,
      stop_date: form.stop_date || null,
      ongoing: form.ongoing,
      complication_ongoing: form.complication_ongoing,
      date_precision: (form.date_precision as SurgicalHistoryInput['date_precision']) ?? 'exact',
      outcome: form.outcome || null,
      complications: form.complications || null,
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
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs">Procedure *</Label>
              {!form.free_text_override ? (
                <SurgicalProcedureCombobox
                  value={
                    form.surgical_procedure_library_id
                      ? { id: form.surgical_procedure_library_id, label: form.procedure_name }
                      : null
                  }
                  onSelect={(result: SurgicalProcedureResult | null) => {
                    setForm({
                      ...form,
                      surgical_procedure_library_id: result?.id ?? '',
                      procedure_code: result?.code ?? '',
                      procedure_name: result?.label ?? '',
                      procedure_source_library: result ? 'surgical_procedure_library' : '',
                    })
                  }}
                />
              ) : (
                <Input
                  id="surgery-name"
                  value={form.procedure_name}
                  onChange={(e) => setForm({ ...form, procedure_name: e.target.value })}
                  placeholder="Enter unlisted procedure"
                />
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.free_text_override}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      free_text_override: e.target.checked,
                      surgical_procedure_library_id: '',
                      procedure_code: '',
                      procedure_source_library: e.target.checked ? 'UNLISTED' : '',
                      procedure_name: '',
                    })
                  }
                />
                Other / Unlisted
              </label>
            </div>

            <div className="space-y-1">
              <Label htmlFor="surgery-date" className="text-xs">Start Date</Label>
              <Input
                id="surgery-date"
                type="date"
                value={form.approximate_date}
                onChange={(e) => setForm({ ...form, approximate_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="surgery-stop-date" className="text-xs">Stop Date</Label>
              <Input
                id="surgery-stop-date"
                type="date"
                value={form.stop_date}
                disabled={form.ongoing}
                onChange={(e) => setForm({ ...form, stop_date: e.target.value })}
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

            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.ongoing} onCheckedChange={(v) => setForm({ ...form, ongoing: !!v, stop_date: v ? '' : form.stop_date })} />
                Ongoing
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.complication_ongoing} onCheckedChange={(v) => setForm({ ...form, complication_ongoing: !!v })} />
                Ongoing complications
              </label>
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
              <Label htmlFor="surgery-complications" className="text-xs">Complications</Label>
              <Input
                id="surgery-complications"
                value={form.complications}
                onChange={(e) => setForm({ ...form, complications: e.target.value })}
                placeholder="None, infection, bleeding, readmission..."
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
                  {row.procedure_code && <span>{row.procedure_code}</span>}
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
                  {row.free_text_override && <span>· Unlisted</span>}
                  {row.stop_date && <span>· Stop {row.stop_date}</span>}
                  {row.ongoing && <span>· Ongoing</span>}
                </div>
                {row.complications && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Complications: {row.complications}
                  </p>
                )}
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
