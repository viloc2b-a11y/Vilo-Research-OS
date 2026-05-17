'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { VISIT_PRESETS } from '@/lib/source-builder/draft-storage'
import { newId } from '@/lib/source-builder/procedure-library'
import type { DraftVisit } from '@/lib/source-builder/types'

type VisitBuilderPanelProps = {
  visits: DraftVisit[]
  onChange: (visits: DraftVisit[]) => void
}

export function VisitBuilderPanel({ visits, onChange }: VisitBuilderPanelProps) {
  function addVisit(preset?: (typeof VISIT_PRESETS)[number]) {
    const row: DraftVisit = {
      id: newId(),
      name: preset?.name ?? `Visit ${visits.length + 1}`,
      visitType: preset?.visitType ?? 'scheduled',
      studyDay: preset?.studyDay ?? '',
      window: preset?.window ?? '',
      notes: '',
    }
    onChange([...visits, row])
  }

  function update(id: string, patch: Partial<DraftVisit>) {
    onChange(visits.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  function remove(id: string) {
    onChange(visits.filter((v) => v.id !== id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Visit builder</CardTitle>
        <CardDescription>Create and edit study visits before attaching procedures.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="flex flex-wrap gap-2">
          {VISIT_PRESETS.map((p) => (
            <Button key={p.name} type="button" variant="outline" size="sm" onClick={() => addVisit(p)}>
              + {p.name}
            </Button>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => addVisit()}>
            + Custom visit
          </Button>
        </section>

        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits yet. Add a preset or custom visit.</p>
        ) : (
          <ul className="space-y-3">
            {visits.map((visit) => (
              <li key={visit.id} className="rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="space-y-1">
                    <Label>Visit name</Label>
                    <Input
                      value={visit.name}
                      onChange={(e) => update(visit.id, { name: e.target.value })}
                    />
                  </p>
                  <p className="space-y-1">
                    <Label>Visit type</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={visit.visitType}
                      onChange={(e) => update(visit.id, { visitType: e.target.value })}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="phone">Phone</option>
                      <option value="eos">End of study</option>
                      <option value="et">Early termination</option>
                      <option value="unscheduled">Unscheduled</option>
                    </select>
                  </p>
                  <p className="space-y-1">
                    <Label>Study day</Label>
                    <Input
                      value={visit.studyDay}
                      placeholder="e.g. 1, -14, Week 4"
                      onChange={(e) => update(visit.id, { studyDay: e.target.value })}
                    />
                  </p>
                  <p className="space-y-1">
                    <Label>Window</Label>
                    <Input
                      value={visit.window}
                      placeholder="e.g. ±3 days"
                      onChange={(e) => update(visit.id, { window: e.target.value })}
                    />
                  </p>
                  <p className="space-y-1 sm:col-span-2">
                    <Label>Notes</Label>
                    <Input
                      value={visit.notes}
                      onChange={(e) => update(visit.id, { notes: e.target.value })}
                    />
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-destructive"
                  onClick={() => remove(visit.id)}
                >
                  Remove visit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
