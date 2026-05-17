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
  saveSubjectMedicalHistoryAction,
  searchPathologyCatalogAction,
} from '@/lib/subject/patient-profile/actions'
import type { SubjectMedicalHistoryRow } from '@/lib/subject/patient-profile/types'

type MedicalHistorySectionProps = {
  studySubjectId: string
  organizationId: string
  initialRows: SubjectMedicalHistoryRow[]
}

const emptyForm = {
  pathologyId: null as string | null,
  customConditionName: '',
  startDate: '',
  ongoing: true,
  stopDate: '',
  clinicallySignificant: '' as '' | 'yes' | 'no',
  comments: '',
}

export function MedicalHistorySection({
  studySubjectId,
  organizationId,
  initialRows,
}: MedicalHistorySectionProps) {
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
    const result = await searchPathologyCatalogAction(query)
    if (!result.ok) return []
    return result.data.map((hit) => ({
      id: hit.pathologyId,
      primary: hit.commonName,
      secondary: [hit.medicalName, hit.icd10Code, hit.system].filter(Boolean).join(' · '),
    }))
  }

  function startEdit(row: SubjectMedicalHistoryRow) {
    setEditingId(row.subjectHistoryId)
    setSelectedCatalog(
      row.pathologyId
        ? {
            id: row.pathologyId,
            primary: row.displayName,
            secondary: row.libraryLabel,
          }
        : null,
    )
    setForm({
      pathologyId: row.pathologyId,
      customConditionName: row.customConditionName ?? '',
      startDate: row.startDate ?? '',
      ongoing: row.ongoing,
      stopDate: row.stopDate ?? '',
      clinicallySignificant:
        row.clinicallySignificant === null
          ? ''
          : row.clinicallySignificant
            ? 'yes'
            : 'no',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await saveSubjectMedicalHistoryAction({
      organizationId,
      studySubjectId,
      subjectHistoryId: editingId,
      pathologyId: selectedCatalog?.id ?? form.pathologyId,
      customConditionName: selectedCatalog ? null : form.customConditionName,
      startDate: form.startDate || null,
      ongoing: form.ongoing,
      stopDate: form.ongoing ? null : form.stopDate || null,
      clinicallySignificant:
        form.clinicallySignificant === ''
          ? null
          : form.clinicallySignificant === 'yes',
      comments: form.comments || null,
    })

    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setRows((prev) => {
      const next = prev.filter((r) => r.subjectHistoryId !== result.data.subjectHistoryId)
      return [result.data, ...next].sort((a, b) => {
        if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1
        return (b.startDate ?? '').localeCompare(a.startDate ?? '')
      })
    })
    resetForm()
  }

  async function stopCondition(row: SubjectMedicalHistoryRow) {
    const stopDate = new Date().toISOString().slice(0, 10)
    setSaving(true)
    setError(null)
    const result = await saveSubjectMedicalHistoryAction({
      organizationId,
      studySubjectId,
      subjectHistoryId: row.subjectHistoryId,
      pathologyId: row.pathologyId,
      customConditionName: row.customConditionName,
      startDate: row.startDate,
      ongoing: false,
      stopDate,
      clinicallySignificant: row.clinicallySignificant,
      comments: row.comments,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setRows((prev) =>
      prev.map((r) => (r.subjectHistoryId === result.data.subjectHistoryId ? result.data : r)),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Medical history</CardTitle>
        <CardDescription>
          Document conditions for this subject. The pathology catalog is a lookup aid only — not
          the patient&apos;s record until you save here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4 rounded-md border border-dashed p-4" onSubmit={handleSubmit}>
          <p className="text-sm font-medium">{editingId ? 'Edit condition' : 'Add condition'}</p>

          <CatalogSearch
            label="Search catalog"
            placeholder="e.g. Headache, Diabetes, GERD"
            emptyHint="Type at least 2 characters to search the pathology catalog."
            selected={selectedCatalog}
            onSelect={(option) => {
              setSelectedCatalog(option)
              setForm((f) => ({ ...f, pathologyId: option?.id ?? null }))
            }}
            onSearch={searchCatalog}
            allowCustom
            customValue={form.customConditionName}
            onCustomChange={(value) =>
              setForm((f) => ({ ...f, customConditionName: value, pathologyId: null }))
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="mh-start">Start date</Label>
              <Input
                id="mh-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mh-significant">Clinically significant</Label>
              <select
                id="mh-significant"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.clinicallySignificant}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clinicallySignificant: e.target.value as '' | 'yes' | 'no',
                  }))
                }
              >
                <option value="">Not specified</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
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
              <Label htmlFor="mh-stop">Stop date</Label>
              <Input
                id="mh-stop"
                type="date"
                value={form.stopDate}
                onChange={(e) => setForm((f) => ({ ...f, stopDate: e.target.value }))}
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="mh-comments">Comments</Label>
            <textarea
              id="mh-comments"
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
              {saving ? 'Saving…' : editingId ? 'Update condition' : 'Add condition'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium">Recorded conditions ({rows.length})</p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medical history recorded yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {rows.map((row) => (
                <li key={row.subjectHistoryId} className="space-y-2 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{row.displayName}</p>
                      {row.libraryLabel ? (
                        <p className="text-xs text-muted-foreground">{row.libraryLabel}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Custom condition</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.startDate ? `Start ${row.startDate}` : 'Start date not set'}
                        {row.ongoing
                          ? ' · Ongoing'
                          : row.stopDate
                            ? ` · Stopped ${row.stopDate}`
                            : ' · Not ongoing'}
                        {row.clinicallySignificant !== null
                          ? ` · ${row.clinicallySignificant ? 'Clinically significant' : 'Not clinically significant'}`
                          : ''}
                      </p>
                      {row.comments ? (
                        <p className="mt-1 text-xs">{row.comments}</p>
                      ) : null}
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
                          onClick={() => void stopCondition(row)}
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
