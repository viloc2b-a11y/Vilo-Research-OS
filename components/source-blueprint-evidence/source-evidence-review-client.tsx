'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { EvidenceExtractPanel } from './evidence-extract-panel'
import { EvidenceListPanel } from './evidence-list-panel'
import { EvidenceDetailPanel } from './evidence-detail-panel'

type StudyOption = { id: string; name: string }

export function SourceEvidenceReviewClient({
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
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending_review')

  const studyIds = useMemo(() => new Set(studies.map((study) => study.id)), [studies])

  const resolveStudyFromUrl = useCallback((): string => {
    const fromQuery = searchParams.get('study_id') ?? initialStudyId ?? ''
    if (fromQuery && studyIds.has(fromQuery)) return fromQuery
    return ''
  }, [initialStudyId, searchParams, studyIds])

  const studyId = resolveStudyFromUrl()
  const selectedStudy = studies.find((study) => study.id === studyId)
  const hasStudyScope = Boolean(studyId)

  const onStudyChange = useCallback(
    (nextStudyId: string) => {
      setSelectedEvidenceId(null)
      const params = new URLSearchParams(searchParams.toString())
      if (nextStudyId) params.set('study_id', nextStudyId)
      else params.delete('study_id')
      const query = params.toString()
      router.replace(query ? `/source-blueprint-evidence?${query}` : '/source-blueprint-evidence', {
        scroll: false,
      })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          P4C · Source Blueprint Evidence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Source Blueprint Evidence
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Formalize why each part of the source exists. Evidence Review links document retrieval to
          blueprint elements with Provenance Trace and coordinator-approved lineage — not runtime
          truth.
        </p>
        <p className="mt-2 rounded border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
          Source is built from protocol, guidance, approved reconciliation, runtime graph, and
          evidence mappings — not directly from a PDF. Operational truth: approved reconciliation →
          runtime generation → published source. No runtime changes occur automatically. Map Evidence
          records associations only; blueprint and source changes require separate manual workflows.
        </p>
      </header>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Study scope
          <select
            className="mt-2 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-2 text-sm"
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
            Review scoped to {selectedStudy.name}.
            <Link
              href={`/document-intelligence?study_id=${encodeURIComponent(studyId)}`}
              className="ml-2 font-medium text-teal-700 hover:underline"
            >
              Document Intelligence
            </Link>
            <Link
              href={`/studies/${studyId}/workspace`}
              className="ml-2 font-medium text-teal-700 hover:underline"
            >
              Study workspace
            </Link>
          </p>
        ) : null}
      </div>

      {!hasStudyScope ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Select a study to extract and review source blueprint evidence.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <EvidenceExtractPanel
              organizationId={organizationId}
              studyId={studyId}
              refreshKey={refreshKey}
              onExtracted={() => {
                setRefreshKey((value) => value + 1)
              }}
            />
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <label className="text-xs font-medium text-slate-600">
                Status filter
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setSelectedEvidenceId(null)
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="pending_review">Pending review</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="mapped">Mapped</option>
                </select>
              </label>
            </div>
            <EvidenceListPanel
              organizationId={organizationId}
              studyId={studyId}
              statusFilter={statusFilter || null}
              refreshKey={refreshKey}
              selectedId={selectedEvidenceId}
              onSelect={setSelectedEvidenceId}
            />
          </div>
          <EvidenceDetailPanel
            organizationId={organizationId}
            studyId={studyId}
            evidenceId={selectedEvidenceId}
            refreshKey={refreshKey}
            onReviewed={() => {
              setRefreshKey((value) => value + 1)
            }}
          />
        </div>
      )}
    </div>
  )
}
