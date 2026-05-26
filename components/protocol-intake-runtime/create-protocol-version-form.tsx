'use client'

import { useState } from 'react'

export function CreateProtocolVersionForm(props: {
  organizationId: string
  protocolRuntimeStudyId: string
  onCreated: (versionId: string) => void
}) {
  const [versionLabel, setVersionLabel] = useState('v1.0')
  const [sourceDocumentId, setSourceDocumentId] = useState('')
  const [amendmentNumber, setAmendmentNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/protocol-intake-runtime/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: props.organizationId,
          protocol_runtime_study_id: props.protocolRuntimeStudyId,
          version_label: versionLabel,
          source_document_id: sourceDocumentId,
          amendment_number: amendmentNumber || null,
        }),
      })
      const data = (await res.json()) as { version?: { id: string }; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create protocol version')
      if (data.version?.id) props.onCreated(data.version.id)
      setSourceDocumentId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">Add protocol version</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-600">
          Version label
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={versionLabel}
            disabled={loading}
            onChange={(e) => setVersionLabel(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-600">
          Amendment number
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={amendmentNumber}
            disabled={loading}
            onChange={(e) => setAmendmentNumber(e.target.value)}
          />
        </label>
      </div>
      <label className="mt-3 block text-sm text-slate-600">
        Source document id (`compliance_runtime_documents.id`)
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs"
          value={sourceDocumentId}
          disabled={loading}
          onChange={(e) => setSourceDocumentId(e.target.value)}
          placeholder="uuid"
        />
      </label>
      <button
        type="button"
        className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={loading || !versionLabel.trim() || !sourceDocumentId.trim()}
        onClick={() => void create()}
      >
        {loading ? 'Creating…' : 'Create version'}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

