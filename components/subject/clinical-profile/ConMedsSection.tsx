// components/subject/clinical-profile/ConMedsSection.tsx
'use client'

import { useState, useTransition } from 'react'
import { Plus, Pill, Pencil, XCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { MedicationCombobox } from './LibrarySearchCombobox'
import type { MedicationResult } from '@/lib/subject/clinical-profile/library-search'
import {
  addConMed,
  updateConMed,
  discontinueConMed,
  verifyProfileEntry,
} from '@/lib/subject/clinical-profile/actions'
import {
  conMedIndicationLabel,
  isConMedMissingDocumentation,
} from '@/lib/subject/clinical-profile/conmed-summary'
import type {
  SubjectConMed,
  ConMedInput,
  SubjectMedicalHistory,
} from '@/lib/subject/clinical-profile/types'

type FormState = {
  medication_id: string
  medication_label: string    // display label for selected medication
  custom_medication_name: string
  indication_history_id: string
  indication_text: string
  dose: string
  dose_unit: string
  frequency: string
  route: string
  prn: boolean
  start_date: string
  ongoing: boolean
  stop_date: string
  source_attribution: string
  comments: string
}

const EMPTY_FORM: FormState = {
  medication_id: '',
  medication_label: '',
  custom_medication_name: '',
  indication_history_id: '',
  indication_text: '',
  dose: '',
  dose_unit: '',
  frequency: '',
  route: '',
  prn: false,
  start_date: '',
  ongoing: true,
  stop_date: '',
  source_attribution: '',
  comments: '',
}

type ConMedsSectionProps = {
  studySubjectId: string
  rows: SubjectConMed[]
  medicalHistory: SubjectMedicalHistory[]
  canVerify?: boolean
  actorRole?: string
}

export function ConMedsSection({ studySubjectId, rows, medicalHistory, canVerify = false, actorRole = 'coordinator' }: ConMedsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [discontinuingId, setDiscontinuingId] = useState<string | null>(null)
  const [discReason, setDiscReason] = useState('')
  const [discReasonStopped, setDiscReasonStopped] = useState('')
  const [discStopDate, setDiscStopDate] = useState('')

  const active = rows.filter((r) => r.status === 'active')
  const onHold = rows.filter((r) => r.status === 'on_hold')
  const discontinued = rows.filter((r) => r.status === 'discontinued')

  const medLabel = (row: SubjectConMed) =>
    row.medication_library?.medication_name ?? row.custom_medication_name ?? 'Unspecified'

  function formatUpdated(iso: string) {
    try {
      return new Date(iso).toLocaleDateString()
    } catch {
      return iso
    }
  }

  function ConMedMeta({ row }: { row: SubjectConMed }) {
    const indication = conMedIndicationLabel(row)
    return (
      <>
        <div className="mt-1 flex flex-wrap gap-1.5 items-center">
          {indication ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              For: {indication}
            </Badge>
          ) : null}
          {row.ongoing && row.status === 'active' ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              Ongoing
            </Badge>
          ) : null}
          {row.status === 'on_hold' ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-800">
              On hold
            </Badge>
          ) : null}
          {isConMedMissingDocumentation(row) ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-800">
              Missing documentation
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.start_date ? `Start ${row.start_date}` : 'Start date not recorded'}
          {row.stop_date ? ` · Stop ${row.stop_date}` : ''}
        </p>
        {row.source_attribution ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Source: {row.source_attribution}</p>
        ) : (
          <p className="mt-0.5 text-[10px] text-amber-700">Source attribution missing</p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Last updated {formatUpdated(row.updated_at)}
        </p>
      </>
    )
  }

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setChangeReason('')
    setError(null)
    setShowForm(true)
    setDiscontinuingId(null)
  }

  function openEdit(row: SubjectConMed) {
    setEditingId(row.conmed_id)
    setForm({
      medication_id: row.medication_id ?? '',
      medication_label: row.medication_library?.medication_name ?? '',
      custom_medication_name: row.custom_medication_name ?? '',
      indication_history_id: row.indication_history_id ?? '',
      indication_text: row.indication_text ?? '',
      dose: row.dose ?? '',
      dose_unit: row.dose_unit ?? '',
      frequency: row.frequency ?? '',
      route: row.route ?? '',
      prn: row.prn,
      start_date: row.start_date ?? '',
      ongoing: row.ongoing,
      stop_date: row.stop_date ?? '',
      source_attribution: row.source_attribution ?? '',
      comments: row.comments ?? '',
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
    setDiscontinuingId(null)
  }

  function handleSubmit() {
    const hasMed = form.custom_medication_name.trim() || form.medication_id
    if (!hasMed) { setError('Medication name is required.'); return }
    if (!form.source_attribution.trim()) { setError('Source attribution is required.'); return }
    if (editingId && !changeReason.trim()) { setError('Reason for change is required.'); return }

    const input: ConMedInput = {
      medication_id: form.medication_id || null,
      custom_medication_name: form.medication_id ? null : (form.custom_medication_name.trim() || null),
      indication_history_id: form.indication_history_id || null,
      indication_text: form.indication_text || null,
      dose: form.dose || null,
      dose_unit: form.dose_unit || null,
      frequency: form.frequency || null,
      route: form.route || null,
      prn: form.prn,
      start_date: form.start_date || null,
      ongoing: form.ongoing,
      source_attribution: form.source_attribution.trim(),
      comments: form.comments || null,
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateConMed(editingId, studySubjectId, { ...input, change_reason: changeReason })
        } else {
          await addConMed(studySubjectId, input)
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

  function handleDiscontinue(id: string) {
    if (!discReason.trim()) { setError('Change reason is required.'); return }
    if (!discReasonStopped.trim()) { setError('Reason stopped is required.'); return }
    startTransition(async () => {
      try {
        await discontinueConMed(id, studySubjectId, discStopDate || null, discReasonStopped, discReason)
        setDiscontinuingId(null)
        setDiscReason('')
        setDiscReasonStopped('')
        setDiscStopDate('')
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred.')
      }
    })
  }

  const activeHistoryRows = medicalHistory.filter((r) => r.status === 'active')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Concomitant Medications</h3>
          <p className="text-xs text-muted-foreground">
            {active.length} active · {onHold.length} on hold · {discontinued.length} discontinued
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add medication
        </Button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-medium">{editingId ? 'Edit medication' : 'New concomitant medication'}</h4>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs">Medication *</Label>
              <MedicationCombobox
                value={form.medication_id ? { id: form.medication_id, label: form.medication_label } : null}
                onSelect={(result: MedicationResult | null) => {
                  if (result) {
                    setForm({
                      ...form,
                      medication_id: result.medication_id,
                      medication_label: result.medication_name,
                      custom_medication_name: '',
                      route: form.route || result.route || '',
                    })
                  } else {
                    setForm({ ...form, medication_id: '', medication_label: '' })
                  }
                }}
                placeholder="Search medication library…"
              />
              {!form.medication_id && (
                <Input
                  id="cm-med"
                  value={form.custom_medication_name}
                  onChange={(e) => setForm({ ...form, custom_medication_name: e.target.value })}
                  placeholder="Or enter custom medication name"
                />
              )}
            </div>

            {activeHistoryRows.length > 0 && (
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="cm-indication" className="text-xs">Indication (link to medical history)</Label>
                <select
                  id="cm-indication"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.indication_history_id}
                  onChange={(e) => setForm({ ...form, indication_history_id: e.target.value })}
                >
                  <option value="">— Select condition (optional) —</option>
                  {activeHistoryRows.map((h) => (
                    <option key={h.subject_history_id} value={h.subject_history_id}>
                      {h.pathology_library?.common_name ?? h.custom_condition_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!form.indication_history_id && (
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="cm-indication-text" className="text-xs">Indication (free text)</Label>
                <Input
                  id="cm-indication-text"
                  value={form.indication_text}
                  onChange={(e) => setForm({ ...form, indication_text: e.target.value })}
                  placeholder="e.g. Hypertension management"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="cm-dose" className="text-xs">Dose</Label>
              <Input id="cm-dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="500" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-unit" className="text-xs">Unit</Label>
              <Input id="cm-unit" value={form.dose_unit} onChange={(e) => setForm({ ...form, dose_unit: e.target.value })} placeholder="mg" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-route" className="text-xs">Route</Label>
              <Input id="cm-route" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="oral, IV, topical…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-frequency" className="text-xs">Frequency</Label>
              <Input id="cm-frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="BID, QD, PRN…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-start" className="text-xs">Start date</Label>
              <Input id="cm-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>

            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.ongoing} onCheckedChange={(v) => setForm({ ...form, ongoing: !!v })} />
                Ongoing
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.prn} onCheckedChange={(v) => setForm({ ...form, prn: !!v })} />
                PRN
              </label>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="cm-source" className="text-xs">Source attribution *</Label>
              <Input
                id="cm-source"
                value={form.source_attribution}
                onChange={(e) => setForm({ ...form, source_attribution: e.target.value })}
                placeholder="e.g. Visit 1 ConMed review, prior prescription records"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="cm-comments" className="text-xs">Comments</Label>
              <Textarea id="cm-comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} rows={2} />
            </div>

            {editingId && (
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="cm-change-reason" className="text-xs">Reason for change *</Label>
                <Input
                  id="cm-change-reason"
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
              {isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add medication'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {active.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">No active concomitant medications documented.</p>
      )}

      <div className="space-y-2">
        {active.map((row) => (
          <div key={row.conmed_id} className="space-y-1">
            <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-sm">
              <div className="flex items-start gap-2 min-w-0">
                <Pill className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {medLabel(row)}
                    {row.medication_library?.brand_name && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">({row.medication_library.brand_name})</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[row.dose, row.dose_unit, row.route, row.frequency].filter(Boolean).join(' · ')}
                    {row.prn && <span className="ml-1 italic">PRN</span>}
                  </p>
                  <ConMedMeta row={row} />
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
                          await verifyProfileEntry('conmeds', row.conmed_id, studySubjectId, actorRole)
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
                  size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => { setDiscontinuingId(discontinuingId === row.conmed_id ? null : row.conmed_id); setError(null) }}
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Inline discontinue form */}
            {discontinuingId === row.conmed_id && (
              <div className="ml-6 rounded-md border bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-medium">Discontinue medication</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`disc-date-${row.conmed_id}`} className="text-xs">Stop date</Label>
                    <Input id={`disc-date-${row.conmed_id}`} type="date" value={discStopDate} onChange={(e) => setDiscStopDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`disc-reason-stopped-${row.conmed_id}`} className="text-xs">Reason stopped *</Label>
                    <Input id={`disc-reason-stopped-${row.conmed_id}`} value={discReasonStopped} onChange={(e) => setDiscReasonStopped(e.target.value)} placeholder="e.g. Completed course, AE" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`disc-change-reason-${row.conmed_id}`} className="text-xs">Change reason *</Label>
                    <Input id={`disc-change-reason-${row.conmed_id}`} value={discReason} onChange={(e) => setDiscReason(e.target.value)} placeholder="ALCOA+ reason" />
                  </div>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleDiscontinue(row.conmed_id)} disabled={isPending}>
                    {isPending ? 'Saving…' : 'Discontinue'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDiscontinuingId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {onHold.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            On hold / unspecified ({onHold.length})
          </h4>
          {onHold.map((row) => (
            <div
              key={row.conmed_id}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2.5"
            >
              <Pill className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{medLabel(row)}</p>
                <ConMedMeta row={row} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {discontinued.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {discontinued.length} discontinued medication{discontinued.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-2">
            {discontinued.map((row) => (
              <div key={row.conmed_id} className="flex items-start gap-2 rounded-md border px-3 py-2.5 opacity-50">
                <Pill className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium line-through">{medLabel(row)}</p>
                  <ConMedMeta row={row} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
