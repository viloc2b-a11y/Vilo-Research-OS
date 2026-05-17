'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CatalogSearch } from '@/components/subject/catalog-search'
import {
  saveSubjectConmedAction,
  searchMedicationCatalogAction,
} from '@/lib/subject/patient-profile/actions'
import type {
  SubjectConmedRow,
  SubjectMedicalHistoryRow,
} from '@/lib/subject/patient-profile/types'

type ConmedSectionProps = {
  studySubjectId: string
  organizationId: string
  initialRows: SubjectConmedRow[]
  medicalHistory: SubjectMedicalHistoryRow[]
}

const emptyForm = {
  medicationId: null as string | null,
  customMedicationName: '',
  indicationHistoryId: '',
  indicationText: '',
  dose: '',
  doseUnit: '',
  frequency: '',
  route: '',
  startDate: '',
  ongoing: true,
  stopDate: '',
  comments: '',
}

export function ConmedSection({
  studySubjectId,
  organizationId,
  initialRows,
  medicalHistory,
}: ConmedSectionProps) {
  const [rows, setRows] = useState(initialRows)
  const [form, setForm] = useState(emptyForm)
  const [selectedCatalog, setSelectedCatalog] = useState<{
    id: string
    primary: string
    secondary?: string | null
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function searchCatalog(query: string) {
    const result = await searchMedicationCatalogAction(query)
    if (!result.ok) return []
    return result.data.map((hit) => ({
      id: hit.medicationId,
      primary: hit.medicationName,
      secondary: [hit.brandName, hit.drugClass, hit.route, hit.dosageForm]
        .filter(Boolean)
        .join(' · '),
      meta: { route: hit.route },
    }))
  }

  function startEdit(row: SubjectConmedRow) {
    setEditingId(row.conmedId)
    setSelectedCatalog(
      row.medicationId
        ? {
            id: row.medicationId,
            primary: row.displayName,
            secondary: row.libraryLabel,
          }
        : null,
    )
    setForm({
      medicationId: row.medicationId,
      customMedicationName: row.customMedicationName ?? '',
      indicationHistoryId: row.indicationHistoryId ?? '',
      indicationText: row.indicationText ?? '',
      dose: row.dose ?? '',
      doseUnit: row.doseUnit ?? '',
      frequency: row.frequency ?? '',
      route: row.route ?? '',
      startDate: row.startDate ?? '',
      ongoing: row.ongoing,
      stopDate: row.stopDate ?? '',
      comments: row.comments ?? '',
    })
    setError(null)
  }

  function resetForm() {
    setEditingId(null)
    setSelectedCatalog(null)
    setForm(emptyForm)
    setError(null)
  }

  function onSelectMedication(
    option: {
      id: string
      primary: string
      secondary?: string | null
      meta?: Record<string, string | null>
    } | null,
  ) {
    setSelectedCatalog(option)
    if (!option) {
      setForm((f) => ({ ...f, medicationId: null }))
      return
    }
    setForm((f) => ({
      ...f,
      medicationId: option.id,
      customMedicationName: '',
      route: f.route || option.meta?.route || '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await saveSubjectConmedAction({
      organizationId,
      studySubjectId,
      conmedId: editingId,
      medicationId: selectedCatalog?.id ?? form.medicationId,
      customMedicationName: selectedCatalog ? null : form.customMedicationName,
      indicationHistoryId: form.indicationHistoryId || null,
      indicationText: form.indicationText || null,
      dose: form.dose || null,
      doseUnit: form.doseUnit || null,
      frequency: form.frequency || null,
      route: form.route || null,
      startDate: form.startDate || null,
      ongoing: form.ongoing,
      stopDate: form.ongoing ? null : form.stopDate || null,
      comments: form.comments || null,
    })

    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setRows((prev) => {
      const next = prev.filter((r) => r.conmedId !== result.data.conmedId)
      return [result.data, ...next]
    })
    resetForm()
  }

  async function stopMedication(row: SubjectConmedRow) {
    const stopDate = new Date().toISOString().slice(0, 10)
    setSaving(true)
    setError(null)
    const result = await saveSubjectConmedAction({
      organizationId,
      studySubjectId,
      conmedId: row.conmedId,
      medicationId: row.medicationId,
      customMedicationName: row.customMedicationName,
      indicationHistoryId: row.indicationHistoryId,
      indicationText: row.indicationText,
      dose: row.dose,
      doseUnit: row.doseUnit,
      frequency: row.frequency,
      route: row.route,
      startDate: row.startDate,
      ongoing: false,
      stopDate,
      comments: row.comments,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setRows((prev) => prev.map((r) => (r.conmedId === result.data.conmedId ? result.data : r)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Concomitant medications</CardTitle>
        <CardDescription>
          Document medications for this subject. The medication catalog is a lookup aid only — not
          the patient&apos;s medication list until you save here. Indications are coordinator-entered
          (not inferred).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4 rounded-md border border-dashed p-4" onSubmit={handleSubmit}>
          <p className="text-sm font-medium">
            {editingId ? 'Edit medication' : 'Add medication'}
          </p>

          <CatalogSearch
            label="Search catalog"
            placeholder="e.g. Metformin, Ibuprofen, Lisinopril"
            emptyHint="Type at least 2 characters to search the medication catalog."
            selected={selectedCatalog}
            onSelect={onSelectMedication}
            onSearch={searchCatalog}
            allowCustom
            customValue={form.customMedicationName}
            onCustomChange={(value) =>
              setForm((f) => ({ ...f, customMedicationName: value, medicationId: null }))
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cm-dose">Dose</Label>
              <Input
                id="cm-dose"
                value={form.dose}
                placeholder="e.g. 500"
                onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-dose-unit">Dose unit</Label>
              <Input
                id="cm-dose-unit"
                value={form.doseUnit}
                placeholder="e.g. mg"
                onChange={(e) => setForm((f) => ({ ...f, doseUnit: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cm-frequency">Frequency</Label>
              <Input
                id="cm-frequency"
                value={form.frequency}
                placeholder="e.g. BID, daily"
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-route">Route</Label>
              <Input
                id="cm-route"
                value={form.route}
                placeholder="e.g. oral"
                onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cm-indication-history">Indication (from medical history)</Label>
            <select
              id="cm-indication-history"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={form.indicationHistoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, indicationHistoryId: e.target.value }))
              }
            >
              <option value="">None selected</option>
              {medicalHistory.map((h) => (
                <option key={h.subjectHistoryId} value={h.subjectHistoryId}>
                  {h.displayName}
                  {h.ongoing ? ' (ongoing)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cm-indication-text">Indication (free text)</Label>
            <Input
              id="cm-indication-text"
              value={form.indicationText}
              placeholder="Optional if not linked to a recorded condition"
              onChange={(e) => setForm((f) => ({ ...f, indicationText: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cm-start">Start date</Label>
              <Input
                id="cm-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ongoing}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ongoing: e.target.checked,
                  stopDate: e.target.checked ? '' : f.stopDate,
                }))
              }
            />
            Ongoing
          </label>

          {!form.ongoing ? (
            <div className="space-y-1">
              <Label htmlFor="cm-stop">Stop date</Label>
              <Input
                id="cm-stop"
                type="date"
                value={form.stopDate}
                onChange={(e) => setForm((f) => ({ ...f, stopDate: e.target.value }))}
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="cm-comments">Comments</Label>
            <textarea
              id="cm-comments"
              className="min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
              value={form.comments}
              onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update medication' : 'Add medication'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium">Recorded medications ({rows.length})</p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No concomitant medications recorded yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {rows.map((row) => (
                <li key={row.conmedId} className="space-y-2 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{row.displayName}</p>
                      {row.libraryLabel ? (
                        <p className="text-xs text-muted-foreground">{row.libraryLabel}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Custom medication</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[row.dose, row.doseUnit].filter(Boolean).join(' ') || 'Dose not set'}
                        {row.frequency ? ` · ${row.frequency}` : ''}
                        {row.route ? ` · ${row.route}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.startDate ? `Start ${row.startDate}` : 'Start date not set'}
                        {row.ongoing
                          ? ' · Ongoing'
                          : row.stopDate
                            ? ` · Stopped ${row.stopDate}`
                            : ' · Not ongoing'}
                      </p>
                      {row.indicationText ? (
                        <p className="mt-1 text-xs">Indication: {row.indicationText}</p>
                      ) : null}
                      {row.comments ? <p className="mt-1 text-xs">{row.comments}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(row)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      {row.ongoing ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void stopMedication(row)}
                          disabled={saving}
                        >
                          Mark stopped
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
