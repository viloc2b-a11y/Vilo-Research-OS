'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SourceBuilderDraft } from '@/lib/source-builder/types'

type DraftHeaderProps = {
  draft: SourceBuilderDraft
  onChange: (patch: Partial<SourceBuilderDraft>) => void
}

export function DraftHeader({ draft, onChange }: DraftHeaderProps) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Source document builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manual draft — not published to capture runtime until a future publish step.
          </p>
        </div>
        <aside className="text-right text-sm">
          <p>
            Status:{' '}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {draft.status}
            </span>
          </p>
          <p className="mt-1 text-muted-foreground">
            Last saved:{' '}
            {draft.lastSavedAt
              ? new Date(draft.lastSavedAt).toLocaleString()
              : 'Not saved yet'}
          </p>
        </aside>
      </header>

      <fieldset className="mt-4 grid gap-4 border-0 p-0 sm:grid-cols-2 lg:grid-cols-3">
        <p className="space-y-1.5">
          <Label htmlFor="draft-name">Draft name</Label>
          <Input
            id="draft-name"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </p>
        <p className="space-y-1.5">
          <Label htmlFor="protocol-nickname">Study / protocol nickname</Label>
          <Input
            id="protocol-nickname"
            value={draft.protocolNickname}
            placeholder="e.g. Site template Q1 2026"
            onChange={(e) => onChange({ protocolNickname: e.target.value })}
          />
        </p>
        <p className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="draft-description">Description (optional)</Label>
          <Input
            id="draft-description"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </p>
      </fieldset>
    </section>
  )
}
