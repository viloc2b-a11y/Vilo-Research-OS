// components/subject/clinical-profile/LifestyleSection.tsx
'use client'

import { useState, useTransition } from 'react'
import { Pencil, Save, Activity } from 'lucide-react'
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
import { upsertLifestyle } from '@/lib/subject/clinical-profile/actions'
import type { SubjectLifestyle, LifestyleInput } from '@/lib/subject/clinical-profile/types'

type LifestyleSectionProps = {
  studySubjectId: string
  lifestyle: SubjectLifestyle | null
}

type FormState = {
  tobacco_status: string
  tobacco_type: string
  tobacco_packs_per_day: string
  tobacco_years: string
  tobacco_quit_year: string
  alcohol_status: string
  alcohol_drinks_per_week: string
  substance_use_status: string
  substance_use_details: string
  exercise_frequency: string
  exercise_details: string
  comments: string
  source_attribution: string
}

function toFormState(l: SubjectLifestyle | null): FormState {
  return {
    tobacco_status: l?.tobacco_status ?? '',
    tobacco_type: l?.tobacco_type ?? '',
    tobacco_packs_per_day: l?.tobacco_packs_per_day?.toString() ?? '',
    tobacco_years: l?.tobacco_years?.toString() ?? '',
    tobacco_quit_year: l?.tobacco_quit_year?.toString() ?? '',
    alcohol_status: l?.alcohol_status ?? '',
    alcohol_drinks_per_week: l?.alcohol_drinks_per_week?.toString() ?? '',
    substance_use_status: l?.substance_use_status ?? '',
    substance_use_details: l?.substance_use_details ?? '',
    exercise_frequency: l?.exercise_frequency ?? '',
    exercise_details: l?.exercise_details ?? '',
    comments: l?.comments ?? '',
    source_attribution: l?.source_attribution ?? '',
  }
}

export function LifestyleSection({ studySubjectId, lifestyle }: LifestyleSectionProps) {
  const [editing, setEditing] = useState(!lifestyle)
  const [form, setForm] = useState<FormState>(toFormState(lifestyle))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!form.source_attribution.trim()) {
      setError('Source attribution is required.')
      return
    }

    const input: LifestyleInput = {
      tobacco_status: (form.tobacco_status || null) as LifestyleInput['tobacco_status'],
      tobacco_type: form.tobacco_type || null,
      tobacco_packs_per_day: form.tobacco_packs_per_day ? parseFloat(form.tobacco_packs_per_day) : null,
      tobacco_years: form.tobacco_years ? parseFloat(form.tobacco_years) : null,
      tobacco_quit_year: form.tobacco_quit_year ? parseInt(form.tobacco_quit_year) : null,
      alcohol_status: (form.alcohol_status || null) as LifestyleInput['alcohol_status'],
      alcohol_drinks_per_week: form.alcohol_drinks_per_week ? parseFloat(form.alcohol_drinks_per_week) : null,
      substance_use_status: (form.substance_use_status || null) as LifestyleInput['substance_use_status'],
      substance_use_details: form.substance_use_details || null,
      exercise_frequency: (form.exercise_frequency || null) as LifestyleInput['exercise_frequency'],
      exercise_details: form.exercise_details || null,
      comments: form.comments || null,
      source_attribution: form.source_attribution.trim(),
    }

    startTransition(async () => {
      try {
        await upsertLifestyle(studySubjectId, input)
        setEditing(false)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred.')
      }
    })
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const setSelect = (key: keyof FormState) => (v: string) =>
    setForm({ ...form, [key]: v })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">Lifestyle & Risk Factors</h3>
            <p className="text-xs text-muted-foreground">
              {lifestyle ? `Last updated ${new Date(lifestyle.updated_at).toLocaleDateString()}` : 'Not yet documented'}
            </p>
          </div>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      {!editing && lifestyle ? (
        <LifestyleReadView lifestyle={lifestyle} />
      ) : (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-5">

          {/* Tobacco */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tobacco</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="tobacco-status" className="text-xs">Status</Label>
                <Select value={form.tobacco_status} onValueChange={setSelect('tobacco_status')}>
                  <SelectTrigger id="tobacco-status"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.tobacco_status === 'current' || form.tobacco_status === 'former' ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="tobacco-type" className="text-xs">Type</Label>
                    <Input id="tobacco-type" value={form.tobacco_type} onChange={set('tobacco_type')} placeholder="Cigarettes, vaping…" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tobacco-ppd" className="text-xs">Packs/day</Label>
                    <Input id="tobacco-ppd" type="number" value={form.tobacco_packs_per_day} onChange={set('tobacco_packs_per_day')} placeholder="0.5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tobacco-years" className="text-xs">Years smoked</Label>
                    <Input id="tobacco-years" type="number" value={form.tobacco_years} onChange={set('tobacco_years')} placeholder="10" />
                  </div>
                  {form.tobacco_status === 'former' && (
                    <div className="space-y-1">
                      <Label htmlFor="tobacco-quit" className="text-xs">Year quit</Label>
                      <Input id="tobacco-quit" type="number" value={form.tobacco_quit_year} onChange={set('tobacco_quit_year')} placeholder="2018" />
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </section>

          {/* Alcohol */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alcohol</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="alcohol-status" className="text-xs">Status</Label>
                <Select value={form.alcohol_status} onValueChange={setSelect('alcohol_status')}>
                  <SelectTrigger id="alcohol-status"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.alcohol_status === 'current' && (
                <div className="space-y-1">
                  <Label htmlFor="alcohol-drinks" className="text-xs">Drinks / week</Label>
                  <Input id="alcohol-drinks" type="number" value={form.alcohol_drinks_per_week} onChange={set('alcohol_drinks_per_week')} placeholder="7" />
                </div>
              )}
            </div>
          </section>

          {/* Substance use */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Substance Use</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="substance-status" className="text-xs">Status</Label>
                <Select value={form.substance_use_status} onValueChange={setSelect('substance_use_status')}>
                  <SelectTrigger id="substance-status"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.substance_use_status === 'current' || form.substance_use_status === 'former') && (
                <div className="space-y-1">
                  <Label htmlFor="substance-details" className="text-xs">Details</Label>
                  <Input id="substance-details" value={form.substance_use_details} onChange={set('substance_use_details')} placeholder="Type and frequency" />
                </div>
              )}
            </div>
          </section>

          {/* Exercise */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercise</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="exercise-freq" className="text-xs">Frequency</Label>
                <Select value={form.exercise_frequency} onValueChange={setSelect('exercise_frequency')}>
                  <SelectTrigger id="exercise-freq"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="occasional">Occasional (&lt;1×/week)</SelectItem>
                    <SelectItem value="moderate">Moderate (1–3×/week)</SelectItem>
                    <SelectItem value="frequent">Frequent (&gt;3×/week)</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="exercise-details" className="text-xs">Details</Label>
                <Input id="exercise-details" value={form.exercise_details} onChange={set('exercise_details')} placeholder="Walking, cycling, gym…" />
              </div>
            </div>
          </section>

          {/* Comments + source */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="lifestyle-comments" className="text-xs">Comments</Label>
              <Textarea id="lifestyle-comments" value={form.comments} onChange={set('comments')} rows={2} placeholder="Additional context" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lifestyle-source" className="text-xs">Source attribution *</Label>
              <Input
                id="lifestyle-source"
                value={form.source_attribution}
                onChange={set('source_attribution')}
                placeholder="e.g. Screening visit intake, subject self-report"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              <Save className="mr-1 h-3.5 w-3.5" />
              {isPending ? 'Saving…' : 'Save lifestyle'}
            </Button>
            {lifestyle && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(toFormState(lifestyle)); setError(null) }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LifestyleReadView({ lifestyle: l }: { lifestyle: SubjectLifestyle }) {
  const items: { label: string; value: string | null }[] = [
    { label: 'Tobacco', value: l.tobacco_status ? `${l.tobacco_status}${l.tobacco_packs_per_day ? ` · ${l.tobacco_packs_per_day} ppd` : ''}${l.tobacco_years ? ` · ${l.tobacco_years}y` : ''}` : null },
    { label: 'Alcohol', value: l.alcohol_status ? `${l.alcohol_status}${l.alcohol_drinks_per_week ? ` · ${l.alcohol_drinks_per_week} drinks/wk` : ''}` : null },
    { label: 'Substance use', value: l.substance_use_status ?? null },
    { label: 'Exercise', value: l.exercise_frequency ?? null },
  ].filter((i) => i.value)

  if (items.length === 0) return <p className="text-sm text-muted-foreground italic">No lifestyle data documented.</p>

  return (
    <dl className="grid gap-2 sm:grid-cols-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 capitalize">{item.value}</dd>
        </div>
      ))}
      {l.comments && (
        <div className="sm:col-span-2 rounded-md border px-3 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Comments</dt>
          <dd className="mt-0.5">{l.comments}</dd>
        </div>
      )}
    </dl>
  )
}
