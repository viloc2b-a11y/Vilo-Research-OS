'use client'

import { useEffect, useState } from 'react'

type RecentDocument = {
  id: string
  operationalDisplayName: string
  originalFilename: string
  documentClassification: string
  createdAt: string
}

function formatDocumentDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

function documentLabel(doc: RecentDocument): string {
  const name = doc.operationalDisplayName || doc.originalFilename || 'Untitled document'
  const type = doc.documentClassification ? ` · ${doc.documentClassification}` : ''
  const date = doc.createdAt ? ` · ${formatDocumentDate(doc.createdAt)}` : ''
  return `${name}${type}${date}`
}

export function CreateProtocolVersionForm(props: {
  organizationId: string
  protocolRuntimeStudyId: string
  initialSourceDocumentId?: string | null
  onCreated: (versionId: string) => void
}) {
  const [versionLabel, setVersionLabel] = useState('v1.0')
  const [sourceDocumentId, setSourceDocumentId] = useState(props.initialSourceDocumentId ?? '')
  const [amendmentNumber, setAmendmentNumber] = useState('')
  const [documents, setDocuments] = useState<RecentDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDocuments() {
      setDocumentsLoading(true)
      setDocumentsError(null)
      try {
        const res = await fetch(
          `/api/document-intake/recent?organization_id=${encodeURIComponent(props.organizationId)}`,
        )
        const data = (await res.json()) as { documents?: RecentDocument[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load documents')
        if (!cancelled) setDocuments(data.documents ?? [])
      } catch (err) {
        if (!cancelled) {
          setDocumentsError(err instanceof Error ? err.message : 'Failed to load documents')
        }
      } finally {
        if (!cancelled) setDocumentsLoading(false)
      }
    }
    void loadDocuments()
    return () => {
      cancelled = true
    }
  }, [props.organizationId])

  async function create() {
    setLoading(true)
    setError(null)
    setInfoMessage(null)
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
          run_extraction_after_create: true,
        }),
      })
      const data = (await res.json()) as {
        version?: { id: string }
        extraction?: { extractionStatus?: string; runStatus?: string }
        extraction_error?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to create protocol version')
      if (data.version?.id) props.onCreated(data.version.id)
      if (data.extraction_error) {
        setInfoMessage(`Version created. Extraction note: ${data.extraction_error}`)
      } else if (data.extraction?.extractionStatus) {
        setInfoMessage(
          `Version created and extraction completed with status ${data.extraction.extractionStatus}.`,
        )
      } else {
        setInfoMessage('Version created.')
      }
      setSourceDocumentId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version')
    } finally {
      setLoading(false)
    }
  }

  const preselectedMissing =
    sourceDocumentId.length > 0 && !documents.some((doc) => doc.id === sourceDocumentId)

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">Add protocol version</h3>
      {props.initialSourceDocumentId ? (
        <div className="mt-2 rounded border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-900">
          <p className="font-medium">Preselected source document</p>
          <p className="mt-1 text-teal-800">
            This version will be created from the document handed off from Document Intelligence.
          </p>
          <p className="mt-1 font-mono text-teal-700">
            source_document_id: {props.initialSourceDocumentId}
          </p>
        </div>
      ) : null}
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
        Source document
        {props.initialSourceDocumentId ? (
          <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-800">
            Preloaded from Document Intelligence
          </span>
        ) : null}
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
          value={sourceDocumentId}
          disabled={loading || documentsLoading}
          onChange={(e) => setSourceDocumentId(e.target.value)}
        >
          <option value="">
            {documentsLoading ? 'Loading documents…' : 'Select an uploaded document'}
          </option>
          {preselectedMissing ? (
            <option value={sourceDocumentId}>
              Preselected document ({sourceDocumentId.slice(0, 8)}…)
            </option>
          ) : null}
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {documentLabel(doc)}
            </option>
          ))}
        </select>
      </label>
      {documentsError ? (
        <p className="mt-2 text-sm text-red-600">{documentsError}</p>
      ) : null}
      {!documentsLoading && !documentsError && documents.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          No documents found for this organization. Upload the protocol in Document Intake first.
        </p>
      ) : null}
      <button
        type="button"
        className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        disabled={loading || !versionLabel.trim() || !sourceDocumentId.trim()}
        onClick={() => void create()}
      >
        {loading ? 'Creating…' : 'Create version and extract'}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {infoMessage ? <p className="mt-2 text-sm text-teal-700">{infoMessage}</p> : null}
    </div>
  )
}
