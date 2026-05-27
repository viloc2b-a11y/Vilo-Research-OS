'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveVisitRuntimeClientStudyId } from '@/lib/visit-runtime-execution/resolve-initial-visit-runtime-study'
import type { VisitRuntimeInstanceRow } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { VisitSnapshotList } from '@/components/visit-runtime-locking/visit-snapshot-list'
import type { VisitRuntimeSnapshotRow } from '@/lib/visit-runtime-locking/visit-locking-types'
import { CreateVisitInstancePanel } from './create-visit-instance-panel'
import { VisitInstanceList } from './visit-instance-list'
import { VisitWorkspace } from './visit-workspace'

type StudyOption = { id: string; name: string }
type SubjectOption = { id: string; subjectIdentifier: string }
type PublishedSourceOption = {
  publicationId: string
  publicationVersion: number
  packageHash: string
}
type VisitShellOption = { id: string; visitCode: string; visitName: string }

type VisitRuntimeClientProps = {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
  invalidStudyIdFromQuery?: boolean
  subjectsByStudy: Record<string, SubjectOption[]>
  publishedSourcesByStudy: Record<string, PublishedSourceOption[]>
  visitShellsByPublication: Record<string, VisitShellOption[]>
  procedureFieldDefinitionsByShell: Record<
    string,
    Array<{ field_id: string; label: string; type: string; required?: boolean }>
  >
}

function InstanceListLoader({
  organizationId,
  studyId,
  subjectId,
  refreshKey,
  selectedId,
  onSelect,
}: {
  organizationId: string
  studyId: string
  subjectId: string
  refreshKey: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [instances, setInstances] = useState<VisitRuntimeInstanceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studyId || !subjectId) {
        setInstances([])
        setLoading(false)
        return
      }
      try {
        const res = await fetch(
          `/api/visit-runtime/instances?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}&subject_id=${encodeURIComponent(subjectId)}`,
        )
        const data = (await res.json()) as { instances?: VisitRuntimeInstanceRow[] }
        if (!cancelled) setInstances(data.instances ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, subjectId, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading visit instances…</p>
  return <VisitInstanceList instances={instances} selectedId={selectedId} onSelect={onSelect} />
}

function SnapshotListLoader({
  organizationId,
  studyId,
  subjectId,
  refreshKey,
  onSelect,
}: {
  organizationId: string
  studyId: string
  subjectId: string
  refreshKey: number
  onSelect: (visitInstanceId: string) => void
}) {
  const [snapshots, setSnapshots] = useState<VisitRuntimeSnapshotRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studyId || !subjectId) {
        setSnapshots([])
        setLoading(false)
        return
      }
      try {
        const res = await fetch(
          `/api/visit-runtime/snapshots?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}&subject_id=${encodeURIComponent(subjectId)}`,
        )
        const data = (await res.json()) as { snapshots?: VisitRuntimeSnapshotRow[] }
        if (!cancelled) setSnapshots(data.snapshots ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, subjectId, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading snapshots…</p>
  return <VisitSnapshotList snapshots={snapshots} onSelect={onSelect} />
}

export function VisitRuntimeClient({
  organizationId,
  studies,
  initialStudyId = null,
  invalidStudyIdFromQuery = false,
  subjectsByStudy,
  publishedSourcesByStudy,
  visitShellsByPublication,
  procedureFieldDefinitionsByShell,
}: VisitRuntimeClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const studyIds = useMemo(() => new Set(studies.map((study) => study.id)), [studies])

  const resolveStudyFromScope = useCallback((): {
    studyId: string
    invalidQuery: boolean
  } => {
    const fromQuery = searchParams.get('study_id')?.trim() ?? ''
    if (fromQuery) {
      if (studyIds.has(fromQuery)) {
        return { studyId: fromQuery, invalidQuery: false }
      }
      return { studyId: '', invalidQuery: true }
    }
    if (invalidStudyIdFromQuery) {
      return { studyId: '', invalidQuery: true }
    }
    return {
      studyId: resolveVisitRuntimeClientStudyId(studies, initialStudyId, false),
      invalidQuery: false,
    }
  }, [initialStudyId, invalidStudyIdFromQuery, searchParams, studies, studyIds])

  const [studyId, setStudyId] = useState(() => resolveStudyFromScope().studyId)
  const [invalidStudyNotice, setInvalidStudyNotice] = useState(
    () => resolveStudyFromScope().invalidQuery,
  )
  const [subjectId, setSubjectId] = useState('')
  const [selectedVisitInstanceId, setSelectedVisitInstanceId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const resolved = resolveStudyFromScope()
    setStudyId(resolved.studyId)
    setInvalidStudyNotice(resolved.invalidQuery)
  }, [resolveStudyFromScope])

  useEffect(() => {
    if (!studyId || invalidStudyNotice) {
      setSubjectId('')
      return
    }
    const subjectsForStudy = subjectsByStudy[studyId] ?? []
    setSubjectId((current) =>
      current && subjectsForStudy.some((subject) => subject.id === current)
        ? current
        : (subjectsForStudy[0]?.id ?? ''),
    )
  }, [invalidStudyNotice, studyId, subjectsByStudy])

  const onStudyChange = useCallback(
    (nextStudyId: string) => {
      setStudyId(nextStudyId)
      setInvalidStudyNotice(false)
      setSubjectId(subjectsByStudy[nextStudyId]?.[0]?.id ?? '')
      setSelectedVisitInstanceId(null)

      const params = new URLSearchParams(searchParams.toString())
      if (nextStudyId) {
        params.set('study_id', nextStudyId)
      } else {
        params.delete('study_id')
      }
      const query = params.toString()
      router.replace(query ? `/visit-runtime?${query}` : '/visit-runtime', { scroll: false })
    },
    [router, searchParams, subjectsByStudy],
  )

  const subjects = subjectsByStudy[studyId] ?? []
  const publishedSources = publishedSourcesByStudy[studyId] ?? []
  const subjectOptionsKey = `${studyId}:${subjects.map((s) => s.id).join(',')}`

  return (
    <div className="space-y-6">
      {invalidStudyNotice ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The requested study is not available or you do not have access. Select a study below to
          continue.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Study
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={studyId}
            onChange={(e) => {
              onStudyChange(e.target.value)
            }}
          >
            {invalidStudyNotice && !studyId ? (
              <option value="">Select study…</option>
            ) : null}
            {studies.map((study) => (
              <option key={study.id} value={study.id}>{study.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Subject
          <select
            key={subjectOptionsKey}
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={subjectId || subjects[0]?.id || ''}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setSelectedVisitInstanceId(null)
            }}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.subjectIdentifier}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CreateVisitInstancePanel
        organizationId={organizationId}
        studyId={studyId}
        subjectId={subjectId}
        publishedSources={publishedSources}
        visitShellsByPublication={visitShellsByPublication}
        onCreated={(visitInstanceId) => {
          setSelectedVisitInstanceId(visitInstanceId)
          setRefreshKey((value) => value + 1)
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Visit workspaces</h3>
            <InstanceListLoader
              organizationId={organizationId}
              studyId={studyId}
              subjectId={subjectId}
              refreshKey={refreshKey}
              selectedId={selectedVisitInstanceId}
              onSelect={setSelectedVisitInstanceId}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Locked snapshots</h3>
            <SnapshotListLoader
              organizationId={organizationId}
              studyId={studyId}
              subjectId={subjectId}
              refreshKey={refreshKey}
              onSelect={setSelectedVisitInstanceId}
            />
          </div>
        </div>
        {selectedVisitInstanceId ? (
          <VisitWorkspace
            key={`${selectedVisitInstanceId}-${refreshKey}`}
            organizationId={organizationId}
            visitInstanceId={selectedVisitInstanceId}
            refreshKey={refreshKey}
            procedureFieldDefinitions={procedureFieldDefinitionsByShell}
            onUpdated={() => setRefreshKey((value) => value + 1)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
            Select or create a visit workspace to capture procedure execution state.
          </div>
        )}
      </div>
    </div>
  )
}
