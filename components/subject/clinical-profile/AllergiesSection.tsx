// components/subject/clinical-profile/AllergiesSection.tsx
'use client'

import { useState, useTransition } from 'react'
import { Plus, ShieldAlert, Pencil, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
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
import { AllergenCombobox } from './LibrarySearchCombobox'
import { addAllergy, updateAllergy, verifyProfileEntry } from '@/lib/subject/clinical-profile/actions'
import {
  DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION,
  resolveClinicalProfileSourceAttribution,
} from '@/lib/subject/clinical-profile/defaults'
import type { AllergenResult } from '@/lib/subject/clinical-profile/library-search-types'
import type { SubjectAllergy, AllergyInput } from '@/lib/subject/clinical-profile/types'

const SEVERITY_LABELS: Record<string, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
  'life-threatening': 'Life-threatening',
  unknown: 'Unknown',
}

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  severe: 'bg-orange-100 text-orange-800',
  'life-threatening': 'bg-red-100 text-red-800',
  unknown: 'bg-muted text-muted-foreground',
}

type AllergyFormState = {
  allergen: string
  allergen_type: string
  reaction: string
  severity: string
  source_attribution: string
  comments: string
}

function emptyAllergyForm(): AllergyFormState {
  return {
    allergen: '',
    allergen_type: '',
    reaction: '',
    severity: '',
    source_attribution: DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION,
    comments: '',
  }
}

type AllergiesSectionProps = {
  studySubjectId: string
  rows: SubjectAllergy[]
  canVerify?: boolean
  actorRole?: string
  /** Override default source line (e.g. visit capture context). */
  defaultSourceAttribution?: string
}

export function AllergiesSection({
  studySubjectId,
  rows,
  canVerify = false,
  actorRole = 'coordinator',
  defaultSourceAttribution,
}: AllergiesSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [form, setForm] = useState<AllergyFormState>(emptyAllergyForm)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const active = rows.filter((r) => r.status === 'active')
  const inactive = rows.filter((r) => r.status !== 'active')
  const [showInactive, setShowInactive] = useState(false)

  function openAdd() {
    setEditingId(null)
    setForm({
      ...emptyAllergyForm(),
      source_attribution:
        defaultSourceAttribution?.trim() || DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION,
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(row: SubjectAllergy) {
    setEditingId(row.allergy_id)
    setForm({
      allergen: row.allergen,
      allergen_type: row.allergen_type ?? '',
      reaction: row.reaction ?? '',
      severity: row.severity ?? '',
      source_attribution: row.source_attribution ?? '',
      comments: row.comments ?? '',
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function handlePickAllergen(result: AllergenResult) {
    setForm((prev) => ({
      ...prev,
      allergen: result.display_name,
      allergen_type: result.allergen_type ?? prev.allergen_type,
    }))
  }

  function handleSubmit() {
    if (!form.allergen.trim()) { setError('Allergen is required.'); return }
    if (editingId && !changeReason.trim()) { setError('Change reason is required when editing.'); return }

    const source_attribution = resolveClinicalProfileSourceAttribution(
      form.source_attribution,
      defaultSourceAttribution,
    )

    const input: AllergyInput = {
      allergen: form.allergen.trim(),
      allergen_type: (form.allergen_type || null) as AllergyInput['allergen_type'],
      reaction: form.reaction || null,
      severity: (form.severity || null) as AllergyInput['severity'],
      source_attribution,
      comments: form.comments || null,
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateAllergy(editingId, studySubjectId, { ...input, change_reason: changeReason })
        } else {
          await addAllergy(studySubjectId, input)
        }
        setShowForm(false)
        setForm(emptyAllergyForm())
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
          <h3 className="text-sm font-semibold">Allergies & Adverse Reactions</h3>
          <p className="text-xs text-muted-foreground">
            {active.length} active {active.length === 1 ? 'allergy' : 'allergies'} documented
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add allergy
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-medium">
            {editingId ? 'Edit allergy' : 'New allergy'}
          </h4>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="allergy-allergen" className="text-xs">Allergen *</Label>
              <AllergenCombobox
                allergen={form.allergen}
                onAllergenChange={(value) => setForm({ ...form, allergen: value })}
                onPick={handlePickAllergen}
                placeholder="Type 2+ letters (e.g. pen) or enter custom allergen"
              />
              <p className="text-[10px] text-muted-foreground">
                Suggestions from allergy vocabulary; custom names are allowed.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="allergy-type" className="text-xs">Type</Label>
              <Select value={form.allergen_type} onValueChange={(v) => setForm({ ...form, allergen_type: v })}>
                <SelectTrigger id="allergy-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drug">Drug</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="contrast">Contrast</SelectItem>
                  <SelectItem value="latex">Latex</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="allergy-severity" className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger id="allergy-severity">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                  <SelectItem value="life-threatening">Life-threatening</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="allergy-reaction" className="text-xs">Reaction description</Label>
              <Input
                id="allergy-reaction"
                value={form.reaction}
                onChange={(e) => setForm({ ...form, reaction: e.target.value })}
                placeholder="Describe the reaction observed"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="allergy-source" className="text-xs">Source attribution</Label>
              <Input
                id="allergy-source"
                value={form.source_attribution}
                onChange={(e) => setForm({ ...form, source_attribution: e.target.value })}
                placeholder={DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION}
              />
              <p className="text-[10px] text-muted-foreground">
                Prefilled from Clinical Profile context; edit if a more specific source applies.
              </p>
            </div>

            {editingId && (
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="allergy-change-reason" className="text-xs">Reason for change *</Label>
                <Input
                  id="allergy-change-reason"
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
              {isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add allergy'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Active rows */}
      {active.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">No allergies documented.</p>
      )}

      <div className="space-y-2">
        {active.map((row) => (
          <AllergyRow
            key={row.allergy_id}
            row={row}
            canVerify={canVerify}
            onEdit={() => openEdit(row)}
            onVerify={() => {
              startTransition(async () => {
                try {
                  await verifyProfileEntry('allergies', row.allergy_id, studySubjectId, actorRole)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Verify failed')
                }
              })
            }}
          />
        ))}
      </div>

      {/* Inactive rows */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {inactive.length} inactive / unconfirmed
          </button>
          {showInactive && inactive.map((row) => (
            <AllergyRow key={row.allergy_id} row={row} onEdit={() => openEdit(row)} dimmed />
          ))}
        </div>
      )}
    </div>
  )
}

function AllergyRow({
  row,
  onEdit,
  onVerify,
  canVerify = false,
  dimmed = false,
}: {
  row: SubjectAllergy
  onEdit: () => void
  onVerify?: () => void
  canVerify?: boolean
  dimmed?: boolean
}) {
  return (
    <div
      className={[
        'flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-sm',
        dimmed ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2 min-w-0">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        <div className="min-w-0">
          <p className="font-medium truncate">{row.allergen}</p>
          {row.reaction && (
            <p className="text-xs text-muted-foreground truncate">{row.reaction}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.allergen_type && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {row.allergen_type}
              </Badge>
            )}
            {row.severity && (
              <span
                className={[
                  'inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium',
                  SEVERITY_COLORS[row.severity] ?? 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {SEVERITY_LABELS[row.severity] ?? row.severity}
              </span>
            )}
            {row.status !== 'active' && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">
                {row.status}
              </Badge>
            )}
          </div>
          {row.source_attribution && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Source: {row.source_attribution}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0 items-center">
        {canVerify && !row.verified_at && onVerify ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-blue-600 hover:text-blue-700"
            title="Verify entry (PI/QA)"
            onClick={onVerify}
          >
            <ShieldCheck className="h-3 w-3" />
          </Button>
        ) : null}
        {row.verified_at ? (
          <span title={`Verified ${new Date(row.verified_at).toLocaleDateString()}`}>
            <ShieldCheck className="h-3 w-3 text-green-600" />
          </span>
        ) : null}
        <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
