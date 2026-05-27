'use client'

import { useState } from 'react'
import { SnapshotReviewWorkspace } from './snapshot-review-workspace'

type StudyOption = { id: string; name: string }
type SubjectOption = { id: string; subjectIdentifier: string }
type SnapshotOption = {
  id: string
  visitCode: string
  visitName: string
  snapshotHash: string
  studyId: string
  subjectId: string
}

type OperationalReviewClientProps = {
  organizationId: string
  studies: StudyOption[]
  subjectsByStudy: Record<string, SubjectOption[]>
  snapshotsByStudy: Record<string, SnapshotOption[]>
}

export function OperationalReviewClient({
  organizationId,
  studies,
  subjectsByStudy,
  snapshotsByStudy,
}: OperationalReviewClientProps) {
  const [studyId, setStudyId] = useState(studies[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const subjects = subjectsByStudy[studyId] ?? []
  const snapshots = (snapshotsByStudy[studyId] ?? []).filter(
    (snapshot) => !subjectId || snapshot.subjectId === subjectId,
  )
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
              setSelectedSnapshotId(null)
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
              setSelectedSnapshotId(null)
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

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Locked snapshots</h3>
          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-500">No locked snapshots for this selection.</p>
          ) : (
            <ul className="space-y-2">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedSnapshotId === snapshot.id
                        ? 'border-slate-400 bg-slate-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                  >
                    <div className="font-medium text-slate-900">
                      {snapshot.visitCode} · {snapshot.visitName}
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-500">
                      {snapshot.snapshotHash.slice(0, 16)}…
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedSnapshotId ? (
          <SnapshotReviewWorkspace
            key={`${selectedSnapshotId}-${refreshKey}`}
            organizationId={organizationId}
            snapshotId={selectedSnapshotId}
            refreshKey={refreshKey}
            onUpdated={() => setRefreshKey((value) => value + 1)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
            Select a locked snapshot to start operational review and open queries.
          </div>
        )}
      </div>
    </div>
  )
}
