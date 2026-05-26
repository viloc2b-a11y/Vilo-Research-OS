'use client'

import { useEffect, useState } from 'react'
import type { RuntimeVisitView, StudyRuntimeGraphJson } from '@/lib/study-runtime-composition/runtime-composition-types'
import { CreateVisitDialog } from './create-visit-dialog'
import { VisitCard } from './visit-card'
import { CompileRuntimeButton } from './compile-runtime-button'
import { RuntimeGraphPreview } from './runtime-graph-preview'

type StudyOption = { id: string; name: string }

type StudyBlueprintOption = {
  id: string
  procedureId: string
  blueprintVersionId: string
  procedureCode: string
  procedureName: string
  visitCode: string | null
}

type StudyVisitComposerProps = {
  organizationId: string
  studies: StudyOption[]
}

function StudyRuntimeLoader({
  organizationId,
  studyId,
  refreshKey,
  children,
}: {
  organizationId: string
  studyId: string
  refreshKey: number
  children: (state: {
    visits: RuntimeVisitView[]
    assignments: StudyBlueprintOption[]
    loading: boolean
    error: string | null
  }) => React.ReactNode
}) {
  const [visits, setVisits] = useState<RuntimeVisitView[]>([])
  const [assignments, setAssignments] = useState<StudyBlueprintOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [visitsRes, assignmentsRes] = await Promise.all([
          fetch(
            `/api/study-runtime/visits?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
          ),
          fetch(
            `/api/study-procedure-blueprints?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
          ),
        ])

        const visitsData = (await visitsRes.json()) as { visits?: RuntimeVisitView[]; error?: string }
        if (!visitsRes.ok) throw new Error(visitsData.error || 'Failed to load visits')

        const assignmentsData = (await assignmentsRes.json()) as {
          assignments?: Array<{
            id: string
            procedureId: string
            blueprintVersionId: string
            procedureCode: string
            procedureName: string
            visitCode: string | null
          }>
          error?: string
        }
        if (!assignmentsRes.ok) {
          throw new Error(assignmentsData.error || 'Failed to load study procedure assignments')
        }

        const assignmentOptions: StudyBlueprintOption[] = (assignmentsData.assignments ?? []).map(
          (row) => ({
            id: row.id,
            procedureId: row.procedureId,
            blueprintVersionId: row.blueprintVersionId,
            procedureCode: row.procedureCode,
            procedureName: row.procedureName,
            visitCode: row.visitCode,
          }),
        )

        if (!cancelled) {
          setVisits(visitsData.visits ?? [])
          setAssignments(assignmentOptions)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load study runtime')
          setVisits([])
          setAssignments([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, refreshKey])

  return <>{children({ visits, assignments, loading, error })}</>
}

export function StudyVisitComposer({ organizationId, studies }: StudyVisitComposerProps) {
  const [studyId, setStudyId] = useState(studies[0]?.id ?? '')
  const [refreshKey, setRefreshKey] = useState(0)
  const [graph, setGraph] = useState<StudyRuntimeGraphJson | null>(null)
  const [graphHash, setGraphHash] = useState<string | null>(null)

  if (!studies.length) {
    return <p className="text-sm text-slate-500">No studies available for runtime composition.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Study
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={studyId}
            onChange={(e) => {
              setStudyId(e.target.value)
              setGraph(null)
              setGraphHash(null)
              setRefreshKey((value) => value + 1)
            }}
          >
            {studies.map((study) => (
              <option key={study.id} value={study.id}>{study.name}</option>
            ))}
          </select>
        </label>
        <CompileRuntimeButton
          organizationId={organizationId}
          studyId={studyId}
          onCompiled={(compiledGraph, hash) => {
            setGraph(compiledGraph)
            setGraphHash(hash)
          }}
        />
      </div>

      <StudyRuntimeLoader key={`${studyId}-${refreshKey}`} organizationId={organizationId} studyId={studyId} refreshKey={refreshKey}>
        {({ visits, assignments, loading, error }) => {
          const nextSequence = visits.reduce((max, visit) => Math.max(max, visit.sequenceOrder), 0) + 1

          return (
            <>
              <CreateVisitDialog
                organizationId={organizationId}
                studyId={studyId}
                nextSequenceOrder={nextSequence}
                onCreated={() => setRefreshKey((value) => value + 1)}
              />

              {loading ? <p className="text-sm text-slate-500">Loading visits…</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  {visits.map((visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      organizationId={organizationId}
                      studyId={studyId}
                      assignments={assignments}
                      onChanged={() => setRefreshKey((value) => value + 1)}
                    />
                  ))}
                </div>
                <RuntimeGraphPreview graph={graph} graphHash={graphHash} />
              </div>
            </>
          )
        }}
      </StudyRuntimeLoader>
    </div>
  )
}
