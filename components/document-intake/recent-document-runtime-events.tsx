'use client'

import { useEffect, useState } from 'react'

type RecentDocument = {
  id: string
  operationalDisplayName: string
  originalFilename: string
  documentClassification: string
  createdBy: string
  createdAt: string
  certifiedCopyAttested: boolean
  expirationDate: string | null
  latestAuditEventType: string | null
  latestAuditEventAt: string | null
}

type RecentDocumentRuntimeEventsProps = {
  organizationId: string
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function shortId(value: string): string {
  return value.length > 8 ? `${value.slice(0, 8)}…` : value
}

export function RecentDocumentRuntimeEvents({
  organizationId,
}: RecentDocumentRuntimeEventsProps) {
  const [documents, setDocuments] = useState<RecentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/document-intake/recent?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as { documents?: RecentDocument[]; error?: string }
        if (!res.ok) {
          throw new Error(data.error || 'Could not load recent documents')
        }
        if (!cancelled) {
          setDocuments(data.documents ?? [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load recent documents')
          setDocuments([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [organizationId])

  return (
    <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-slate-800">Recent uploads</h2>
      <p className="mb-4 text-sm text-slate-500">Operational visibility for the compliance runtime.</p>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents uploaded yet.</p>
      ) : null}

      <div className="space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">{doc.operationalDisplayName}</span>
              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {doc.documentClassification}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              File: {doc.originalFilename} · Uploaded by {shortId(doc.createdBy)} · {formatWhen(doc.createdAt)}
            </div>
            <div className="text-xs text-slate-600">
              <strong>Certified copy:</strong>{' '}
              {doc.certifiedCopyAttested ? (
                <span className="text-amber-700">Attested</span>
              ) : (
                <span>Not attested</span>
              )}
            </div>
            <div className="text-xs text-slate-600">
              <strong>Expiration:</strong> {doc.expirationDate ? formatWhen(doc.expirationDate) : 'None'}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400">
              Latest audit: {doc.latestAuditEventType ?? '—'}
              {doc.latestAuditEventAt ? ` · ${formatWhen(doc.latestAuditEventAt)}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
