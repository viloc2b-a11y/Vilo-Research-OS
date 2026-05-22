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
import type { SourceBuilderDraft } from '@/lib/source-builder/types'

type DraftActionsProps = {
  draft: SourceBuilderDraft
  onSave: () => void
  savedMessage: string | null
  saveError?: string | null
  saving?: boolean
  persistenceMode?: 'server' | 'local'
}

export function DraftActions({
  draft,
  onSave,
  savedMessage,
  saveError = null,
  saving = false,
  persistenceMode = 'local',
}: DraftActionsProps) {
  const [showPreview, setShowPreview] = useState(false)
  const previewJson = JSON.stringify(
    {
      draft: {
        name: draft.name,
        protocolNickname: draft.protocolNickname,
        visits: draft.visits.length,
        procedures: draft.procedures.length,
        matrixAssignments: draft.matrix.length,
      },
      visits: draft.visits,
      procedures: draft.procedures.map((p) => ({
        id: p.id,
        name: p.displayName,
        profileCode: p.profileCode,
        fieldCount: p.fields.filter((f) => !f.hidden).length,
      })),
      matrix: draft.matrix,
    },
    null,
    2,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft actions</CardTitle>
        <CardDescription>
          {persistenceMode === 'server'
            ? 'Saves to your organization workspace. Publish to runtime uses CPST compile + publish_source_package (Phase 6A.6).'
            : 'Saves in this browser only until you have an organization membership.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide' : 'Preview'} source structure
        </Button>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Publish blocked here: use a study workspace with approved package artifacts.
        </span>
        {savedMessage ? (
          <span className="text-sm text-green-700 dark:text-green-400">{savedMessage}</span>
        ) : null}
        {saveError ? (
          <span className="text-sm text-destructive" role="alert">
            {saveError}
          </span>
        ) : null}
      </CardContent>
      {showPreview ? (
        <CardContent className="border-t pt-4">
          <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{previewJson}</pre>
        </CardContent>
      ) : null}
    </Card>
  )
}
