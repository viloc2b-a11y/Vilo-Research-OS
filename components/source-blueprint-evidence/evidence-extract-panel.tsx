'use client'

import { useEffect, useState } from 'react'

type IntelligenceDoc = {
  id: string
  sourceFilename: string
  intelligenceStatus: string
}

type EvidenceExtractPanelProps = {
  organizationId: string
  studyId: string
  refreshKey: number
  onExtracted: () => void
}

export function EvidenceExtractPanel({
  organizationId,
  studyId,
  refreshKey,
  onExtracted,
}: EvidenceExtractPanelProps) {
  const [documents, setDocuments] = useState<IntelligenceDoc[]>([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(
          `/api/document-intelligence/documents?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
        )
        const data = (await res.json()) as {
          documents?: Array<{
            id: string
            sourceFilename: string
            intelligenceStatus: string
          }>
        }
        if (!cancelled) {
          const ready = (data.documents ?? []).filter(
            (doc) => doc.intelligenceStatus === 'ready',
          )
          // Prefer documents that are likely active references (latest ready per filename)
          setDocuments(ready)
          setSelectedDocId((current) => current || ready[0]?.id || '')
        }
      } catch {
        if (!cancelled) setDocuments([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, refreshKey])

  async function handleExtract() {
    if (!selectedDocId) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/source-blueprint-evidence/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          intelligence_document_id: selectedDocId,
          usage_domain: 'source_creation',
        }),
      })
      const data = (await res.json()) as {
        createdCount?: number
        skippedCount?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setMessage(
        `Extracted ${data.createdCount ?? 0} evidence item(s)${data.skippedCount ? ` · ${data.skippedCount} skipped (duplicate)` : ''}`,
      )
      onExtracted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Extract evidence</h2>
      <p className="mt-1 text-xs text-slate-500">
        Pull structured evidence from indexed chunks (source_creation domain). Requires Document
        Intelligence ingest first.
      </p>
      <label className="mt-3 block text-sm text-slate-600">
        Intelligence document
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
        >
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.sourceFilename}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="mt-3 w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={loading || !selectedDocId}
        onClick={() => void handleExtract()}
      >
        {loading ? 'Extracting…' : 'Extract from document'}
      </button>
      {message ? <p className="mt-2 text-xs text-teal-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
