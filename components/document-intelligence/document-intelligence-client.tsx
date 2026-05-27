'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { IngestDocumentPanel } from './ingest-document-panel'
import { IntelligenceDocumentList } from './intelligence-document-list'
import { IntelligenceSearchPanel } from './intelligence-search-panel'
import { IntelligenceDocumentDetail } from './intelligence-document-detail'

type StudyOption = { id: string; name: string }

const WORKFLOW_STEPS = [
  'Select a study',
  'Ingest uploaded documents',
  'Search study documents',
  'Review referenced source chunks',
] as const

export function DocumentIntelligenceClient({
  organizationId,
  studies,
  initialStudyId = null,
}: {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [studyId, setStudyId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)

  const studyIds = useMemo(() => new Set(studies.map((study) => study.id)), [studies])

  const resolveStudyFromUrl = useCallback((): string => {
    const fromQuery = searchParams.get('study_id') ?? initialStudyId ?? ''
    if (fromQuery && studyIds.has(fromQuery)) return fromQuery
    return ''
  }, [initialStudyId, searchParams, studyIds])

  useEffect(() => {
    setStudyId(resolveStudyFromUrl())
  }, [resolveStudyFromUrl])

  const selectedStudy = studies.find((study) => study.id === studyId)
  const hasStudyScope = Boolean(studyId)

  const onStudyChange = useCallback(
    (nextStudyId: string) => {
      setStudyId(nextStudyId)
      setSelectedDocumentId(null)

      const params = new URLSearchParams(searchParams.toString())
      if (nextStudyId) {
        params.set('study_id', nextStudyId)
      } else {
        params.delete('study_id')
      }
      const query = params.toString()
      router.replace(query ? `/document-intelligence?${query}` : '/document-intelligence', {
        scroll: false,
      })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Global · Study-scoped evidence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document Intelligence</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search and review study documents used to support protocol intake, source design, budget
          review, and operational guidance.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          K1 operates on one selected study at a time. Search, ingest, and chunk review never span
          multiple studies. Review every result before operational use — this layer does not replace
          approved runtime truth.
        </p>
      </header>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Study scope
          <select
            className="mt-2 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
            value={studyId}
            onChange={(e) => onStudyChange(e.target.value)}
          >
            <option value="">Select a study…</option>
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.name}
              </option>
            ))}
          </select>
        </label>
        {selectedStudy ? (
          <p className="mt-2 text-xs text-slate-500">
            All actions apply only to{' '}
            <span className="font-medium text-slate-700">{selectedStudy.name}</span>. Switch study to
            work on a different protocol — cross-study search is not available in K1.
            <Link
              href={`/studies/${studyId}/workspace`}
              className="ml-2 font-medium text-teal-700 hover:underline"
            >
              Study workspace
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Choose a study to continue. Open from a study workspace to preselect{' '}
            <code className="rounded bg-slate-100 px-1">?study_id=…</code>.
          </p>
        )}
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-slate-600">
        {WORKFLOW_STEPS.map((step, index) => (
          <li
            key={step}
            className={`rounded-full border px-2.5 py-1 ${
              hasStudyScope || index === 0
                ? 'border-slate-200 bg-white text-slate-700'
                : 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            <span className="font-medium text-slate-500">{index + 1}.</span> {step}
          </li>
        ))}
      </ol>

      {!hasStudyScope ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            Select a study above to ingest documents, run study-scoped search, and review source
            chunks.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <IngestDocumentPanel
              organizationId={organizationId}
              studyId={studyId}
              refreshKey={refreshKey}
              onIngested={() => {
                setRefreshKey((value) => value + 1)
              }}
            />
            <IntelligenceSearchPanel organizationId={organizationId} studyId={studyId} />
            <IntelligenceDocumentList
              organizationId={organizationId}
              studyId={studyId}
              refreshKey={refreshKey}
              selectedId={selectedDocumentId}
              onSelect={setSelectedDocumentId}
            />
          </div>
          <IntelligenceDocumentDetail
            organizationId={organizationId}
            studyId={studyId}
            intelligenceDocumentId={selectedDocumentId}
            refreshKey={refreshKey}
            onVersionsChanged={() => setRefreshKey((value) => value + 1)}
          />
        </div>
      )}
    </div>
  )
}
