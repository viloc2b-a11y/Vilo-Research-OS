'use client'

import { useEffect, useState } from 'react'
import type { DocumentIntelligenceDocumentRow } from '@/lib/document-intelligence/document-intelligence-types'

type IntelligenceDocumentListProps = {
  organizationId: string
  studyId: string
  refreshKey: number
  selectedId: string | null
  onSelect: (id: string) => void
}

export function IntelligenceDocumentList({
  organizationId,
  studyId,
  refreshKey,
  selectedId,
  onSelect,
}: IntelligenceDocumentListProps) {
  const [documents, setDocuments] = useState<DocumentIntelligenceDocumentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studyId) {
        setDocuments([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `/api/document-intelligence/documents?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
        )
        const data = (await res.json()) as { documents?: DocumentIntelligenceDocumentRow[] }
        if (!cancelled) setDocuments(data.documents ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading intelligence documents…</p>

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Knowledge registry</h2>
      {documents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No intelligence documents for this study yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className={
                  selectedId === doc.id
                    ? 'vilo-surface-active block w-full px-2 py-2 text-left text-sm'
                    : 'group block w-full px-2 py-2 text-left text-sm hover:bg-slate-50'
                }
                onClick={() => onSelect(doc.id)}
              >
                <span className="font-medium text-slate-900">{doc.sourceFilename}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {doc.intelligenceStatus} · {doc.extractionStatus} · {doc.embeddingStatus}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
