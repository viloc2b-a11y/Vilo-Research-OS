'use client'

import { useEffect, useState } from 'react'
import {
  resolveDefaultDomains,
  type DocumentIntelligenceDomain,
} from '@/lib/document-intelligence/document-domain-mapper'
import { DocumentDomainChecklist } from './document-domain-checklist'
import { domainLabel } from './document-intelligence-domain-ui'
import { pollIntelligenceDocumentUntilSettled } from './poll-intelligence-document'

type RecentDoc = {
  id: string
  operationalDisplayName: string
  originalFilename: string
  documentClassification: string
}

type IngestDocumentPanelProps = {
  organizationId: string
  studyId: string
  refreshKey: number
  onIngested: () => void
}

export function IngestDocumentPanel({
  organizationId,
  studyId,
  refreshKey,
  onIngested,
}: IngestDocumentPanelProps) {
  const [documents, setDocuments] = useState<RecentDoc[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedDomains, setSelectedDomains] = useState<DocumentIntelligenceDomain[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const selectedDoc = documents.find((doc) => doc.id === selectedId)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(
          `/api/document-intake/recent?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as { documents?: RecentDoc[] }
        if (!cancelled) {
          setDocuments(data.documents ?? [])
          setSelectedId((current) => current || data.documents?.[0]?.id || '')
        }
      } catch {
        if (!cancelled) setDocuments([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, refreshKey])

  useEffect(() => {
    if (!selectedDoc) {
      setSelectedDomains([])
      return
    }
    setSelectedDomains(resolveDefaultDomains(selectedDoc.documentClassification))
  }, [selectedDoc])

  async function handleIngest() {
    if (!selectedId || !studyId) {
      setError('Select a compliance document and study.')
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/document-intelligence/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          compliance_document_id: selectedId,
          study_id: studyId,
          domains: selectedDomains,
        }),
      })
      const data = (await res.json()) as {
        status?: string
        intelligence_document_id?: string
        applied_domains?: DocumentIntelligenceDomain[]
        result?: {
          alreadyReady?: boolean
          extractedChunkCount?: number
          runStatus?: string
          appliedDomains?: DocumentIntelligenceDomain[]
          quarantined?: boolean
          classificationMetadata?: Record<string, unknown>
        }
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Ingestion failed')

      if (data.result?.quarantined) {
        setMessage(
          'Document quarantined for PHI review. Open document detail to release with coordinator notes.',
        )
        onIngested()
        return
      }

      const meta = data.result?.classificationMetadata
      if (meta?.tier === 'suggest') {
        setMessage(
          `Ingestion started. Classification suggested (${String(meta.suggested_classification)}) — confirm domains if needed.`,
        )
      } else if (meta?.tier === 'manual_review') {
        setMessage('Ingestion started. Manual classification review recommended.')
      }

      const applied =
        data.applied_domains ?? data.result?.appliedDomains ?? []

      if (data.status === 'processing' && data.intelligence_document_id) {
        setMessage('Ingestion in progress — indexing knowledge chunks…')
        const settled = await pollIntelligenceDocumentUntilSettled(
          organizationId,
          studyId,
          data.intelligence_document_id,
        )
        if (settled?.intelligenceStatus === 'ready') {
          setMessage(
            `Ingestion completed · ${settled.chunkCount} knowledge chunks · domains: ${applied.map(domainLabel).join(', ')}`,
          )
        } else if (settled?.intelligenceStatus === 'failed') {
          setMessage('Ingestion failed — review document detail.')
        } else {
          setMessage('Ingestion still processing — refresh or open document detail.')
        }
      } else if (data.result?.alreadyReady) {
        setMessage(
          `Document already indexed · domains: ${applied.map(domainLabel).join(', ') || 'defaults'}`,
        )
      } else {
        setMessage(
          `Ingestion ${data.result?.runStatus ?? 'completed'} · ${data.result?.extractedChunkCount ?? 0} knowledge chunks · domains: ${applied.map(domainLabel).join(', ')}`,
        )
      }
      onIngested()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Ingest for search</h2>
      <p className="mt-1 text-xs text-slate-500">
        Index an uploaded compliance document for study-scoped search. Ingestion is manual — not
        automatic on upload.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Compliance document
          <select
            className="ml-2 max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.operationalDisplayName} · {doc.documentClassification}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={loading || !selectedId}
          onClick={() => void handleIngest()}
        >
          {loading ? 'Ingesting…' : 'Add to Document Intelligence'}
        </button>
      </div>
      <DocumentDomainChecklist
        selected={selectedDomains}
        onChange={setSelectedDomains}
        disabled={!selectedId || loading}
      />
      {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
