'use client'

import { useEffect, useState } from 'react'
import type {
  DocumentIntelligenceChunkRow,
  DocumentIntelligenceDocumentRow,
} from '@/lib/document-intelligence/document-intelligence-types'
import { DocumentVersionControl } from './document-version-control'
import { DocumentQuarantinePanel } from './document-quarantine-panel'

type IntelligenceDocumentDetailProps = {
  organizationId: string
  studyId: string
  intelligenceDocumentId: string | null
  refreshKey: number
  onVersionsChanged: () => void
}

export function IntelligenceDocumentDetail({
  organizationId,
  studyId,
  intelligenceDocumentId,
  refreshKey,
  onVersionsChanged,
}: IntelligenceDocumentDetailProps) {
  const [document, setDocument] = useState<DocumentIntelligenceDocumentRow | null>(null)
  const [chunks, setChunks] = useState<DocumentIntelligenceChunkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [localRefresh, setLocalRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    async function load() {
      if (!intelligenceDocumentId) {
        setDocument(null)
        setChunks([])
        stopPolling()
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `/api/document-intelligence/documents/${encodeURIComponent(intelligenceDocumentId)}?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
        )
        const data = (await res.json()) as {
          document?: DocumentIntelligenceDocumentRow
          chunks?: DocumentIntelligenceChunkRow[]
          error?: string
        }
        if (!res.ok) throw new Error(data.error || 'Failed to load document')
        if (!cancelled) {
          setDocument(data.document ?? null)
          setChunks(data.chunks ?? [])
          const status = data.document?.intelligenceStatus
          if (
            status === 'ready' ||
            status === 'failed' ||
            status === 'archived' ||
            status === 'superseded'
          ) {
            stopPolling()
          }
        }
      } catch {
        if (!cancelled) {
          setDocument(null)
          setChunks([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    pollTimer = setInterval(() => {
      if (!cancelled) void load()
    }, 4000)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [organizationId, studyId, intelligenceDocumentId, refreshKey, localRefresh])

  if (!intelligenceDocumentId) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
        Select an intelligence document to view chunk details and version control.
      </div>
    )
  }

  if (loading && !document) return <p className="text-sm text-slate-500">Loading document detail…</p>
  if (!document) return <p className="text-sm text-slate-500">Document not found.</p>

  return (
    <div className="vilo-scroll-contained max-h-[70vh] rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Referenced source chunks</h2>
      <p className="mt-1 text-xs text-slate-500">
        Review indexed chunks before operational use — evidence lookup only.
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900">{document.sourceFilename}</p>
      <dl className="mt-3 space-y-1 text-xs text-slate-600">
        <div>
          Version: v{document.versionNumber}
          {document.versionLabel ? ` (${document.versionLabel})` : ''}
        </div>
        <div>Status: {document.intelligenceStatus}</div>
        <div>Extraction: {document.extractionStatus}</div>
        <div>Embeddings: {document.embeddingStatus}</div>
        <div>Chunks: {chunks.length}</div>
        <div className="font-mono text-slate-400">Hash: {document.sourceHash.slice(0, 16)}…</div>
      </dl>

      {document.intelligenceStatus === 'quarantine' ? (
        <DocumentQuarantinePanel
          organizationId={organizationId}
          studyId={studyId}
          intelligenceDocumentId={intelligenceDocumentId}
          quarantineReason={document.quarantineReason}
          ingestionRunId={
            typeof document.quarantineReason.ingestion_run_id === 'string'
              ? document.quarantineReason.ingestion_run_id
              : null
          }
          onReleased={() => {
            setLocalRefresh((v) => v + 1)
            onVersionsChanged()
          }}
        />
      ) : null}

      {document.classificationMetadata &&
      Object.keys(document.classificationMetadata).length > 0 ? (
        <section className="mt-3 rounded border border-slate-100 bg-slate-50/80 p-2 text-xs text-slate-600">
          <h3 className="font-medium text-slate-700">Auto-classification</h3>
          <p>
            Tier: {String(document.classificationMetadata.tier ?? '—')} · Confidence:{' '}
            {String(document.classificationMetadata.confidence ?? '—')}
          </p>
          {document.classificationMetadata.suggested_classification ? (
            <p>
              Suggested: {String(document.classificationMetadata.suggested_classification)}
            </p>
          ) : null}
        </section>
      ) : null}

      <DocumentVersionControl
        organizationId={organizationId}
        studyId={studyId}
        intelligenceDocumentId={intelligenceDocumentId}
        refreshKey={refreshKey + localRefresh}
        onChanged={() => {
          setLocalRefresh((v) => v + 1)
          onVersionsChanged()
        }}
      />

      <ul className="mt-4 space-y-2">
        {chunks.slice(0, 12).map((chunk) => (
          <li key={chunk.id} className="rounded border border-slate-100 bg-slate-50 p-2 text-xs">
            <span className="font-medium text-slate-700">#{chunk.chunkIndex}</span>
            {chunk.sectionTitle ? (
              <span className="text-slate-500"> · {chunk.sectionTitle}</span>
            ) : null}
            <p className="mt-1 line-clamp-3 text-slate-600">{chunk.cleanChunkText}</p>
          </li>
        ))}
      </ul>
      {chunks.length > 12 ? (
        <p className="mt-2 text-xs text-slate-400">Showing first 12 chunks.</p>
      ) : null}
    </div>
  )
}
