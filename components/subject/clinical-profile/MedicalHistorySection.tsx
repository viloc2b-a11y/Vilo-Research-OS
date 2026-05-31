// components/subject/clinical-profile/MedicalHistorySection.tsx
// Medical History section — Phase 6C.
// Uses PathologyCombobox for library-backed search + free-text fallback.
// Supports verify (CRA/PI role) via verifyProfileEntry action.

'use client'

import { useState, useTransition } from 'react'
import { Plus, Stethoscope, Pencil, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PathologyCombobox } from './LibrarySearchCombobox'
import type { PathologyResult } from '@/lib/subject/clinical-profile/library-search-types'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  addMedicalHistory,
  updateMedicalHistory,
  resolveMedicalHistory,
  verifyProfileEntry,
} from '@/lib/subject/clinical-profile/actions'
import type {
  SubjectMedicalHistory,
  MedicalHistoryInput,
  ClinicalSeverity,
} from '@/lib/subject/clinical-profile/types'

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-green-100 text-green-800 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  severe: 'bg-orange-100 text-orange-800 border-orange-200',
  'life-threatening': 'bg-red-100 text-red-800 border-red-200',
}

type FormState = {
  pathology_id: string
  custom_condition_name: string
  library_label: string   // display label for selected pathology
  onset_date: string
  approximate_onset: boolean
  ongoing: boolean
  end_date: string
  clinically_significant: boolean | null
  severity: string
  source_attribution: string
  comments: string
}

const EMPTY_FORM: FormState = {
  pathology_id: '',
  custom_condition_name: '',
  library_label: '',
  onset_date: '',
  approximate_onset: false,
  ongoing: true,
  end_date: '',
  clinically_significant: null,
  severity: '',
  source_attribution: '',
  comments: '',
}

type MedicalHistorySectionProps = {
  studySubjectId: string
  rows: SubjectMedicalHistory[]
  canVerify?: boolean     // CRA / PI role from server
  actorRole?: string
}

export function MedicalHistorySection({ studySubjectId, rows, canVerify = false, actorRole = 'coordinator' }: MedicalHistorySectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveReason, setResolveReason] = useState('')
  const [resolveEndDate, setResolveEndDate] = useState('')

  const active = rows.filter((r) => r.status === 'active')
  const resolved = rows.filter((r) => r.status !== 'active')

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setChangeReason('')
    setError(null)
    setShowForm(true)
    setResolvingId(null)
  }

  function openEdit(row: SubjectMedicalHistory) {
    setEditingId(row.subject_history_id)
    setForm({
      pathology_id: row.pathology_id ?? '',
      custom_condition_name: row.custom_condition_name ?? '',
      library_label: row.pathology_library?.common_name ?? '',
      onset_date: row.onset_date ?? '',
      approximate_onset: row.approximate_onset,
      ongoing: row.ongoing,
      end_date: row.end_date ?? '',
      clinically_significant: row.clinically_significant ?? null,
      severity: row.severity ?? '',
      source_attribution: row.source_attribution ?? '',
      comments: row.comments ?? '',
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
    setResolvingId(null)
  }

  function handleSubmit() {
    const hasCondition = form.custom_condition_name.trim() || form.pathology_id
    if (!hasCondition) { setError('Condition name is required.'); return }
    if (!form.source_attribution.trim()) { setError('Source attribution is required.'); return }
    if (form.ongoing && form.end_date) { setError('Stop Date must be empty when Ongoing is selected.'); return }
    if (!form.ongoing && !form.end_date) { setError('Stop Date is required when Ongoing is not selected.'); return }
    if (editingId && !changeReason.trim()) { setError('Reason for change is required.'); return }

    const input: MedicalHistoryInput = {
      pathology_id: form.pathology_id || null,
      custom_condition_name: form.pathology_id ? null : (form.custom_condition_name.trim() || null),
      onset_date: form.onset_date || null,
      approximate_onset: form.approximate_onset,
      ongoing: form.ongoing,
      end_date: form.end_date || null,
      clinically_significant: form.clinically_significant,
      severity: (form.severity as ClinicalSeverity) || null,
      source_attribution: form.source_attribution.trim(),
      comments: form.comments || null,
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateMedicalHistory(editingId, studySubjectId, { ...input, change_reason: changeReason })
        } else {
          await addMedicalHistory(studySubjectId, input)
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

  function handleResolve(id: string) {
    if (!resolveReason.trim()) { setError('Reason for resolving is required.'); return }
    startTransition(async () => {
      try {
        await resolveMedicalHistory(id, studySubjectId, resolveEndDate || null, resolveReason)
        setResolvingId(null)
        setResolveReason('')
        setResolveEndDate('')
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred.')
      }
    })
  }

  const conditionLabel = (row: SubjectMedicalHistory) =>
    row.pathology_library?.common_name ?? row.custom_condition_name ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Medical History</h3>
          <p className="text-xs text-muted-foreground">
            {active.length} active condition{active.length !== 1 ? 's' : ''} · {resolved.length} resolved
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add condition
        </Button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-medium">{editingId ? 'Edit condition' : 'New medical history entry'}</h4>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs">Condition *</Label>
              <PathologyCombobox
                value={form.pathology_id ? { id: form.pathology_id, label: form.library_label } : null}
                onSelect={(result: PathologyResult | null) => {
                  if (result) {
                    setForm({ ...form, pathology_id: result.pathology_id, library_label: result.common_name, custom_condition_name: '' })
                  } else {
                    setForm({ ...form, pathology_id: '', library_label: '' })
                  }
                }}
                placeholder="Search pathology library…"
              />
              {!form.pathology_id && (
                <Input
                  id="mh-condition"
                  value={form.custom_condition_name}
                  onChange={(e) => setForm({ ...form, custom_condition_name: e.target.value })}
                  placeholder="Or enter custom condition name"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="mh-onset" className="text-xs">Start Date</Label>
              <Input
                id="mh-onset"
                type="date"
                value={form.onset_date}
                onChange={(e) => setForm({ ...form, onset_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="mh-stop" className="text-xs">Stop Date</Label>
              <Input
                id="mh-stop"
                type="date"
                value={form.end_date}
                disabled={form.ongoing}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="mh-severity" className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger id="mh-severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                  <SelectItem value="life-threatening">Life-threatening</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.ongoing}
                  onCheckedChange={(v) => setForm({ ...form, ongoing: !!v, end_date: v ? '' : form.end_date })}
                />
                Ongoing
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.approximate_onset}
                  onCheckedChange={(v) => setForm({ ...form, approximate_onset: !!v })}
                />
                Approximate onset date
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.clinically_significant === true}
                  onCheckedChange={(v) => setForm({ ...form, clinically_significant: v ? true : null })}
                />
                Clinically significant
              </label>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="mh-source" className="text-xs">Source attribution *</Label>
              <Input
                id="mh-source"
                value={form.source_attribution}
                onChange={(e) => setForm({ ...form, source_attribution: e.target.value })}
                placeholder="e.g. Visit 1 intake form, Prior records"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="mh-comments" className="text-xs">Comments</Label>
              <Textarea
                id="mh-comments"
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                rows={2}
                placeholder="Additional notes"
              />
            </div>

            {editingId && (
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="mh-change-reason" className="text-xs">Reason for change *</Label>
                <Input
                  id="mh-change-reason"
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
              {isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add condition'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Active rows */}
      {active.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">No active medical history documented.</p>
      )}
      <div className="space-y-2">
        {active.map((row) => (
          <div key={row.subject_history_id} className="space-y-1">
            <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-sm">
              <div className="flex items-start gap-2 min-w-0">
                <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{conditionLabel(row)}</p>
                  {row.pathology_library && (
                    <p className="text-xs text-muted-foreground">{row.pathology_library.medical_name} · {row.pathology_library.icd10_code}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                    {row.severity && (
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${SEVERITY_COLORS[row.severity] ?? ''}`}>
                        {row.severity}
                      </span>
                    )}
                    {row.ongoing && <Badge variant="outline" className="text-[10px] py-0 px-1.5">Ongoing</Badge>}
                    {row.clinically_significant && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Clinically significant</Badge>}
                    {row.onset_date && <span className="text-xs text-muted-foreground">Since {row.onset_date}</span>}
                  </div>
                  {row.source_attribution && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Source: {row.source_attribution}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 items-center">
                {canVerify && !row.verified_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-blue-600 hover:text-blue-700"
                    title="Verify entry (CRA/PI)"
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await verifyProfileEntry('medical_history', row.subject_history_id, studySubjectId, actorRole)
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Verify failed')
                        }
                      })
                    }}
                  >
                    <ShieldCheck className="h-3 w-3" />
                  </Button>
                )}
                {row.verified_at && (
                  <span title={`Verified ${new Date(row.verified_at).toLocaleDateString()}`}>
                    <ShieldCheck className="h-3 w-3 text-green-600" />
                  </span>
                )}
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(row)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => { setResolvingId(resolvingId === row.subject_history_id ? null : row.subject_history_id); setError(null) }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Inline resolve form */}
            {resolvingId === row.subject_history_id && (
              <div className="ml-6 rounded-md border bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-medium">Mark as resolved</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`resolve-date-${row.subject_history_id}`} className="text-xs">Stop Date</Label>
                    <Input id={`resolve-date-${row.subject_history_id}`} type="date" value={resolveEndDate} onChange={(e) => setResolveEndDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`resolve-reason-${row.subject_history_id}`} className="text-xs">Reason *</Label>
                    <Input id={`resolve-reason-${row.subject_history_id}`} value={resolveReason} onChange={(e) => setResolveReason(e.target.value)} placeholder="e.g. Confirmed resolved at Visit 2" />
                  </div>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleResolve(row.subject_history_id)} disabled={isPending}>
                    {isPending ? 'Saving…' : 'Mark resolved'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resolved rows */}
      {resolved.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {resolved.length} resolved condition{resolved.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-2">
            {resolved.map((row) => (
              <div key={row.subject_history_id} className="flex items-start gap-2 rounded-md border px-3 py-2.5 opacity-50">
                <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate line-through">{conditionLabel(row)}</p>
                  <p className="text-xs text-muted-foreground">Resolved{row.end_date ? ` ${row.end_date}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
