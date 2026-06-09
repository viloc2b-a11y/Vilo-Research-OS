'use client'

import { useState } from 'react'

type PublishedSourceOption = {
  publicationId: string
  publicationVersion: number
  packageHash: string
}
type VisitShellOption = { id: string; visitCode: string; visitName: string }

type CreateVisitInstancePanelProps = {
  organizationId: string
  studyId: string
  subjectId: string
  publishedSources: PublishedSourceOption[]
  visitShellsByPublication: Record<string, VisitShellOption[]>
  onCreated: (visitInstanceId: string) => void
}

export function CreateVisitInstancePanel({
  organizationId,
  studyId,
  subjectId,
  publishedSources,
  visitShellsByPublication,
  onCreated,
}: CreateVisitInstancePanelProps) {
  const [publicationId, setPublicationId] = useState(publishedSources[0]?.publicationId ?? '')
  const [visitShellId, setVisitShellId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = publishedSources.find((p) => p.publicationId === publicationId) ?? null
  const visitShells = visitShellsByPublication[publicationId] ?? []
  const effectiveVisitShellId = visitShellId || visitShells[0]?.id || ''

  async function handleCreate() {
    if (!publicationId || !effectiveVisitShellId) {
      setError('Select a published source version and visit shell.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/visit-runtime/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          subject_id: subjectId,
          source_publication_id: publicationId,
          visit_shell_id: effectiveVisitShellId,
        }),
      })
      const data = (await res.json()) as { visit_instance_id?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create visit workspace')
      if (data.visit_instance_id) onCreated(data.visit_instance_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit workspace')
    } finally {
      setLoading(false)
    }
  }

  if (!subjectId) {
    return <p className="text-sm text-slate-500">Select a subject to create a visit workspace.</p>
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Create visit workspace</h2>
      <p className="mt-1 text-xs text-slate-500">
        Create the visit from an approved source version, then open the generated procedure list.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Published source version
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={publicationId}
            onChange={(e) => {
              setPublicationId(e.target.value)
              setVisitShellId('')
            }}
          >
            {publishedSources.map((pub) => (
              <option key={pub.publicationId} value={pub.publicationId}>
                v{pub.publicationVersion}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Visit shell
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={effectiveVisitShellId}
            onChange={(e) => setVisitShellId(e.target.value)}
          >
            {visitShells.map((shell) => (
              <option key={shell.id} value={shell.id}>
                {shell.visitCode} · {shell.visitName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={loading || publishedSources.length === 0}
          onClick={() => void handleCreate()}
        >
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Selected source</span>{' '}
        {selected ? (
          <span>
            v{selected.publicationVersion}
            {' · '}
            <span className="font-mono">{selected.packageHash.slice(0, 12)}…</span>
          </span>
        ) : (
          '—'
        )}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
