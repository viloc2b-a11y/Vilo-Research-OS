'use client'

import { useState } from 'react'

export function PublishSourcePackageButton(props: {
  organizationId: string
  studyId: string
  sourcePackageId: string
  disabled?: boolean
  onPublished: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handlePublish() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/runtime-source-publication/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: props.organizationId,
          study_id: props.studyId,
          source_package_id: props.sourcePackageId,
        }),
      })
      const data = (await res.json()) as { error?: string; publication?: { id: string; publicationVersion: number } }
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setMessage(`Published source version ${data.publication?.publicationVersion ?? '—'}.`)
      props.onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={props.disabled || loading}
        onClick={() => void handlePublish()}
        className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? 'Publishing…' : 'Publish source package'}
      </button>
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

