'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  LoadedProtocolRuntimeStudy,
  ProtocolRuntimeStudyRow,
  ProtocolRuntimeVersionRow,
} from '@/lib/protocol-intake-runtime/protocol-intake-types'
import { CreateProtocolRuntimeStudyDialog } from './create-protocol-runtime-study-dialog'
import { CreateProtocolVersionForm } from './create-protocol-version-form'
import { ProtocolRuntimeStudyList } from './protocol-runtime-study-list'
import { ProtocolVersionPanel } from './protocol-version-panel'

function StudyLoader(props: {
  organizationId: string
  refreshKey: number
  selectedId: string | null
  preselectStudyId?: string | null
  onSelect: (id: string) => void
}) {
  const [studies, setStudies] = useState<ProtocolRuntimeStudyRow[]>([])
  const [loading, setLoading] = useState(true)
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/protocol-intake-runtime/studies?organization_id=${encodeURIComponent(props.organizationId)}`,
        )
        const data = (await res.json()) as { studies?: ProtocolRuntimeStudyRow[] }
        if (cancelled) return
        const list = data.studies ?? []
        setStudies(list)
        // Preselect the protocol runtime study linked to the workspace study (studies.id),
        // falling back to a direct protocol_runtime_studies.id match. Runs once; never auto-creates.
        if (!autoSelectedRef.current && props.preselectStudyId && !props.selectedId) {
          const match =
            list.find((study) => study.studyId === props.preselectStudyId) ??
            list.find((study) => study.id === props.preselectStudyId)
          if (match) {
            autoSelectedRef.current = true
            props.onSelect(match.id)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.organizationId, props.refreshKey, props.preselectStudyId])

  if (loading) return <p className="text-sm text-slate-500">Loading protocol studies…</p>
  return <ProtocolRuntimeStudyList studies={studies} selectedId={props.selectedId} onSelect={props.onSelect} />
}

function StudyDetail(props: {
  organizationId: string
  studyRuntimeId: string
  refreshKey: number
  initialSourceDocumentId?: string | null
  onRefresh: () => void
}) {
  const [loaded, setLoaded] = useState<LoadedProtocolRuntimeStudy | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/protocol-intake-runtime/studies/${encodeURIComponent(props.studyRuntimeId)}?organization_id=${encodeURIComponent(props.organizationId)}`,
        )
        const data = (await res.json()) as (LoadedProtocolRuntimeStudy & { error?: string })
        if (!res.ok) throw new Error(data.error || 'Failed to load protocol runtime study')
        if (!cancelled) {
          setLoaded(data)
          const firstVersion = data.versions?.[0]?.id ?? null
          setSelectedVersionId((current) => current ?? firstVersion)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load study')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.organizationId, props.studyRuntimeId, props.refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading study…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!loaded) return <p className="text-sm text-slate-500">Study not found.</p>

  const selectedVersion =
    loaded.versions.find((v) => v.id === selectedVersionId) ?? loaded.versions[0] ?? null

  return (
    <div className="space-y-6">
      <header className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {loaded.study.protocolNumber} · {loaded.study.protocolTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Status: {loaded.study.protocolStatus} · Current version{' '}
          {loaded.study.currentProtocolVersionId ? loaded.study.currentProtocolVersionId.slice(0, 8) : '—'}…
        </p>
      </header>

      <CreateProtocolVersionForm
        organizationId={props.organizationId}
        protocolRuntimeStudyId={loaded.study.id}
        initialSourceDocumentId={props.initialSourceDocumentId}
        onCreated={(versionId) => {
          setSelectedVersionId(versionId)
          props.onRefresh()
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Version
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={selectedVersionId ?? ''}
            onChange={(e) => setSelectedVersionId(e.target.value)}
          >
            {loaded.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionLabel} · {v.extractionStatus}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedVersion ? (
        <ProtocolVersionPanel
          organizationId={props.organizationId}
          version={selectedVersion as ProtocolRuntimeVersionRow}
          refreshKey={props.refreshKey}
          onRefresh={props.onRefresh}
        />
      ) : (
        <p className="text-sm text-slate-500">No versions created yet.</p>
      )}
    </div>
  )
}

export function ProtocolIntakeRuntimeClient(props: {
  organizationId: string
  initialStudyId?: string | null
  initialSourceDocumentId?: string | null
}) {
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <CreateProtocolRuntimeStudyDialog
        organizationId={props.organizationId}
        onCreated={(studyId) => {
          setSelectedStudyId(studyId)
          setRefreshKey((v) => v + 1)
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <StudyLoader
          organizationId={props.organizationId}
          refreshKey={refreshKey}
          selectedId={selectedStudyId}
          preselectStudyId={props.initialStudyId}
          onSelect={setSelectedStudyId}
        />
        {selectedStudyId ? (
          <StudyDetail
            organizationId={props.organizationId}
            studyRuntimeId={selectedStudyId}
            refreshKey={refreshKey}
            initialSourceDocumentId={props.initialSourceDocumentId}
            onRefresh={() => setRefreshKey((v) => v + 1)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
            Select a protocol runtime study to manage versions and run extraction.
          </div>
        )}
      </div>
    </div>
  )
}

