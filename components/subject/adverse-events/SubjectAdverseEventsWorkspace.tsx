'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubjectAdverseEventsSummary } from '@/components/subject/adverse-events/SubjectAdverseEventsSummary'
import { SubjectAdverseEventsTimeline } from '@/components/subject/adverse-events/SubjectAdverseEventsTimeline'
import {
  addSubjectAdverseEvent,
  updateSubjectAdverseEvent,
} from '@/lib/subject/adverse-events/actions'
import { DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION } from '@/lib/subject/clinical-profile/defaults'
import { searchAeControlledTerms } from '@/lib/subject/clinical-profile/library-search'
import type { AeControlledTermResult } from '@/lib/subject/clinical-profile/library-search-types'
import type { SubjectAdverseEventsTimelineModel } from '@/lib/subject/adverse-events/types'
import type { AdverseEventLifecycleStatus } from '@/lib/subject/adverse-events/types'
import type {
  SubjectAdverseEventInput,
  SubjectAdverseEventRelationship,
  SubjectAdverseEventSeverity,
  SubjectAdverseEventVisitOption,
} from '@/lib/subject/adverse-events/registry-types'

type AeFormState = {
  event_term: string
  preferred_term: string
  ae_type: string
  severity: string
  seriousness: boolean
  relationship_to_ip: string
  expectedness: string
  action_taken: string
  outcome: string
  ongoing: boolean
  requires_pi_si_review: boolean
  lifecycle_status: AdverseEventLifecycleStatus
  visit_id: string
  onset_date: string
  resolution_date: string
  source_attribution: string
  comments: string
}

function emptyAeForm(): AeFormState {
  return {
    event_term: '',
    preferred_term: '',
    ae_type: '',
    severity: '',
    seriousness: false,
    relationship_to_ip: '',
    expectedness: '',
    action_taken: '',
    outcome: '',
    ongoing: true,
    requires_pi_si_review: false,
    lifecycle_status: 'open',
    visit_id: '',
    onset_date: '',
    resolution_date: '',
    source_attribution: 'Subject-reported / AE workspace',
    comments: '',
  }
}

function formToInput(form: AeFormState): SubjectAdverseEventInput {
  return {
    event_term: form.event_term,
    preferred_term: form.preferred_term || null,
    ae_type: form.ae_type || null,
    severity: (form.severity as SubjectAdverseEventSeverity) || null,
    seriousness: form.seriousness,
    relationship_to_ip: (form.relationship_to_ip as SubjectAdverseEventRelationship) || null,
    expectedness: form.expectedness || null,
    action_taken: form.action_taken || null,
    outcome: form.outcome || null,
    ongoing: form.ongoing,
    requires_pi_si_review: form.requires_pi_si_review,
    lifecycle_status: form.lifecycle_status,
    visit_id: form.visit_id || null,
    onset_date: form.onset_date || null,
    resolution_date: form.resolution_date || null,
    source_attribution: form.source_attribution || DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION,
    comments: form.comments || null,
  }
}

function mapAeSeverityCode(code: string) {
  const map: Record<string, string> = {
    MILD: 'mild',
    MODERATE: 'moderate',
    SEVERE: 'severe',
    LIFE_THREATENING: 'life-threatening',
    UNKNOWN: 'unknown',
  }
  return map[code] ?? code.toLowerCase().replace(/_/g, '-')
}

function mapAeRelatednessCode(code: string) {
  const map: Record<string, string> = {
    RELATED: 'related',
    POSSIBLY_RELATED: 'possibly_related',
    POSSIBLE: 'possibly_related',
    NOT_RELATED: 'not_related',
    UNLIKELY: 'unlikely',
    UNKNOWN: 'unknown',
  }
  return map[code] ?? code.toLowerCase()
}

function ControlledSelect({
  value,
  terms,
  fallback = [],
  mapCode = (code) => code,
  onValueChange,
}: {
  value: string
  terms?: AeControlledTermResult[]
  fallback?: [string, string][]
  mapCode?: (code: string) => string
  onValueChange: (value: string) => void
}) {
  const options = terms?.length
    ? terms.map((term) => [mapCode(term.code), term.label] as [string, string])
    : fallback

  return (
    <Select value={value || '_none'} onValueChange={(v) => onValueChange(v === '_none' ? '' : v)}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">—</SelectItem>
        {options.map(([code, label]) => (
          <SelectItem key={`${code}-${label}`} value={code}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type SubjectAdverseEventsWorkspaceProps = {
  model: SubjectAdverseEventsTimelineModel
  studySubjectId: string
  visitOptions: SubjectAdverseEventVisitOption[]
}

export function SubjectAdverseEventsWorkspace({
  model,
  studySubjectId,
  visitOptions,
}: SubjectAdverseEventsWorkspaceProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingRegistryId, setEditingRegistryId] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [form, setForm] = useState<AeFormState>(emptyAeForm)
  const [controlledTerms, setControlledTerms] = useState<Record<string, AeControlledTermResult[]>>({})
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const groups = [
      'AE_TYPE',
      'AE_SEVERITY',
      'AE_RELATEDNESS',
      'EXPECTEDNESS',
      'AE_ACTION_TAKEN',
      'AE_OUTCOME',
    ]
    let cancelled = false
    Promise.all(groups.map(async (group) => [group, await searchAeControlledTerms(group)] as const))
      .then((pairs) => {
        if (!cancelled) setControlledTerms(Object.fromEntries(pairs))
      })
      .catch(() => {
        if (!cancelled) setControlledTerms({})
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openAdd() {
    setEditingRegistryId(null)
    setForm(emptyAeForm())
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(registryId: string) {
    const item = model.sections
      .flatMap((s) => s.items)
      .find((row) => row.registryId === registryId)
    if (!item) return

    setEditingRegistryId(registryId)
    setForm({
      event_term: item.eventTerm,
      preferred_term: item.preferredTerm ?? '',
      ae_type: '',
      severity: item.severity ?? '',
      seriousness: item.isSeriousAdverseEvent,
      relationship_to_ip: item.relationshipCode ?? '',
      expectedness: '',
      action_taken: '',
      outcome: '',
      ongoing: !item.resolutionDate,
      requires_pi_si_review: false,
      lifecycle_status: item.lifecycleStatus,
      visit_id: item.visitId ?? '',
      onset_date: item.onsetDate ?? '',
      resolution_date: item.resolutionDate ?? '',
      source_attribution: item.sourceAttribution,
      comments: item.registryComments ?? '',
    })
    setChangeReason('')
    setError(null)
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.event_term.trim()) {
      setError('AE term is required.')
      return
    }
    if (form.ongoing && form.resolution_date) {
      setError('Stop Date must be empty when Ongoing is selected.')
      return
    }
    if (!form.ongoing && !form.resolution_date) {
      setError('Stop Date is required when Ongoing is not selected.')
      return
    }
    if (editingRegistryId && !changeReason.trim()) {
      setError('Change reason is required when updating an AE.')
      return
    }

    startTransition(async () => {
      try {
        const input = formToInput(form)
        if (editingRegistryId) {
          await updateSubjectAdverseEvent(editingRegistryId, studySubjectId, {
            ...input,
            change_reason: changeReason.trim(),
          })
        } else {
          await addSubjectAdverseEvent(studySubjectId, input)
        }
        setShowForm(false)
        setEditingRegistryId(null)
        setForm(emptyAeForm())
        setChangeReason('')
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Adverse events / Safety
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Document subject-level AEs here. Source capture and workflow items still appear in the
            timeline below for operational awareness.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd} disabled={isPending}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add AE
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border bg-muted/20 p-4 space-y-3"
        >
          <h3 className="text-sm font-medium">
            {editingRegistryId ? 'Edit adverse event' : 'New adverse event'}
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">AE term *</Label>
              <Input
                value={form.event_term}
                onChange={(e) => setForm({ ...form, event_term: e.target.value })}
                placeholder="e.g. Headache, Nausea"
                required
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Preferred / coded term</Label>
              <Input
                value={form.preferred_term}
                onChange={(e) => setForm({ ...form, preferred_term: e.target.value })}
                placeholder="Optional MedDRA or internal term"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">AE type</Label>
              <ControlledSelect
                value={form.ae_type}
                terms={controlledTerms.AE_TYPE}
                onValueChange={(value) => setForm({ ...form, ae_type: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Severity</Label>
              <ControlledSelect
                value={form.severity}
                terms={controlledTerms.AE_SEVERITY}
                fallback={[
                  ['mild', 'Mild'],
                  ['moderate', 'Moderate'],
                  ['severe', 'Severe'],
                  ['life-threatening', 'Life-threatening'],
                  ['unknown', 'Unknown'],
                ]}
                mapCode={mapAeSeverityCode}
                onValueChange={(value) => setForm({ ...form, severity: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={form.lifecycle_status}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    lifecycle_status: v as AdverseEventLifecycleStatus,
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relationship to IP</Label>
              <ControlledSelect
                value={form.relationship_to_ip}
                terms={controlledTerms.AE_RELATEDNESS}
                fallback={[
                  ['related', 'Related'],
                  ['possibly_related', 'Possibly related'],
                  ['not_related', 'Not related'],
                  ['unlikely', 'Unlikely'],
                  ['unknown', 'Unknown'],
                ]}
                mapCode={mapAeRelatednessCode}
                onValueChange={(value) => setForm({ ...form, relationship_to_ip: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expectedness</Label>
              <ControlledSelect
                value={form.expectedness}
                terms={controlledTerms.EXPECTEDNESS}
                onValueChange={(value) => setForm({ ...form, expectedness: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action taken</Label>
              <ControlledSelect
                value={form.action_taken}
                terms={controlledTerms.AE_ACTION_TAKEN}
                onValueChange={(value) => setForm({ ...form, action_taken: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outcome</Label>
              <ControlledSelect
                value={form.outcome}
                terms={controlledTerms.AE_OUTCOME}
                onValueChange={(value) => setForm({ ...form, outcome: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Linked visit</Label>
              <Select
                value={form.visit_id || '_none'}
                onValueChange={(v) =>
                  setForm({ ...form, visit_id: v === '_none' ? '' : v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {visitOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={form.onset_date}
                onChange={(e) => setForm({ ...form, onset_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stop Date</Label>
              <Input
                type="date"
                value={form.resolution_date}
                disabled={form.ongoing}
                onChange={(e) => setForm({ ...form, resolution_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                id="ae-serious"
                type="checkbox"
                checked={form.seriousness}
                onChange={(e) => setForm({ ...form, seriousness: e.target.checked })}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="ae-serious" className="text-xs font-normal cursor-pointer">
                Serious adverse event (SAE)
              </Label>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-normal">
                <input
                  type="checkbox"
                  checked={form.ongoing}
                  onChange={(e) => setForm({ ...form, ongoing: e.target.checked, resolution_date: e.target.checked ? '' : form.resolution_date })}
                  className="h-4 w-4 rounded border"
                />
                Ongoing
              </label>
              <label className="flex items-center gap-2 text-xs font-normal">
                <input
                  type="checkbox"
                  checked={form.requires_pi_si_review}
                  onChange={(e) => setForm({ ...form, requires_pi_si_review: e.target.checked })}
                  className="h-4 w-4 rounded border"
                />
                Requires PI/SI review
              </label>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Source attribution</Label>
              <Input
                value={form.source_attribution}
                onChange={(e) => setForm({ ...form, source_attribution: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Comments</Label>
              <Textarea
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                rows={2}
              />
            </div>
            {editingRegistryId ? (
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Change reason *</Label>
                <Input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Required for audit trail"
                />
              </div>
            ) : null}
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {editingRegistryId ? 'Save changes' : 'Add AE'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setShowForm(false)
                setEditingRegistryId(null)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <SubjectAdverseEventsSummary summary={model.summary} />
      <SubjectAdverseEventsTimeline
        sections={model.sections}
        onEditRegistry={openEdit}
      />
    </div>
  )
}
