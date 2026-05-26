'use client'

import { useEffect, useState } from 'react'
import type { VisitRuntimeInstanceRow } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { VisitSnapshotList } from '@/components/visit-runtime-locking/visit-snapshot-list'
import type { VisitRuntimeSnapshotRow } from '@/lib/visit-runtime-locking/visit-locking-types'
import { CreateVisitInstancePanel } from './create-visit-instance-panel'
import { VisitInstanceList } from './visit-instance-list'
import { VisitWorkspace } from './visit-workspace'

type StudyOption = { id: string; name: string }
type SubjectOption = { id: string; subjectIdentifier: string }
type PackageOption = { id: string; packageName: string; packageVersion: number }
type VisitShellOption = { id: string; visitCode: string; visitName: string }

type VisitRuntimeClientProps = {
  organizationId: string
  studies: StudyOption[]
  subjectsByStudy: Record<string, SubjectOption[]>
  packagesByStudy: Record<string, PackageOption[]>
  visitShellsByPackage: Record<string, VisitShellOption[]>
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
  subjectsByStudy,
  packagesByStudy,
  visitShellsByPackage,
  procedureFieldDefinitionsByShell,
}: VisitRuntimeClientProps) {
  const [studyId, setStudyId] = useState(studies[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [selectedVisitInstanceId, setSelectedVisitInstanceId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const subjects = subjectsByStudy[studyId] ?? []
  const packages = packagesByStudy[studyId] ?? []
  const subjectOptionsKey = `${studyId}:${subjects.map((s) => s.id).join(',')}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Study
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={studyId}
            onChange={(e) => {
              const nextStudyId = e.target.value
              setStudyId(nextStudyId)
              setSubjectId(subjectsByStudy[nextStudyId]?.[0]?.id ?? '')
              setSelectedVisitInstanceId(null)
            }}
          >
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
        packages={packages}
        visitShellsByPackage={visitShellsByPackage}
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
