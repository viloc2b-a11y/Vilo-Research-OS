'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  deleteSourceBuilderDraftAction,
  listSourceBuilderDraftsAction,
} from '@/lib/source-builder/draft-actions-server'
import {
  deleteDraft as deleteLocalDraft,
  listDraftSummaries as listLocalDraftSummaries,
} from '@/lib/source-builder/draft-storage'

type SourceBuilderDraftListProps = {
  organizationId?: string | null
}

export function SourceBuilderDraftList({ organizationId = null }: SourceBuilderDraftListProps) {
  const [drafts, setDrafts] = useState<
    { id: string; name: string; lastSavedAt: string | null }[]
  >([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    if (organizationId) {
      const result = await listSourceBuilderDraftsAction(organizationId)
      if (!result.ok) {
        setLoadError(result.error)
        setDrafts([])
        return
      }
      setDrafts(
        result.data.map((d) => ({
          id: d.id,
          name: d.name,
          lastSavedAt: d.lastSavedAt,
        })),
      )
      return
    }
    setDrafts(listLocalDraftSummaries())
  }, [organizationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft?')) return
    setDeletingId(id)
    try {
      if (organizationId) {
        const result = await deleteSourceBuilderDraftAction(id, organizationId)
        if (!result.ok) {
          setLoadError(result.error)
          return
        }
      } else {
        deleteLocalDraft(id)
      }
      await refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Saved drafts</CardTitle>
        <CardDescription>
          {organizationId
            ? 'Stored in your organization workspace (synced across devices).'
            : 'Stored in this browser only — join an organization to sync drafts.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.lastSavedAt
                      ? `Saved ${new Date(d.lastSavedAt).toLocaleString()}`
                      : 'Never saved'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/source-builder/manual?draft=${d.id}`}
                    className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                  >
                    Open
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={deletingId === d.id}
                    onClick={() => void handleDelete(d.id)}
                  >
                    {deletingId === d.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
