'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  GENERATION_STATUS,
  type ProtocolRuntimeGenerationRunRow,
  type ValidationError,
} from '@/lib/protocol-runtime-generation/protocol-runtime-generation-types'
import { GenerationReadinessPanel } from './generation-readiness-panel'
import { GenerationPreviewPanel } from './generation-preview-panel'
import { GenerationRunList } from './generation-run-list'
import { GenerationResultSummary } from './generation-result-summary'
import { GenerateRuntimeButton } from './generate-runtime-button'
import { GenerationVersionSelector } from './generation-version-selector'

type ReadinessState = {
  ready: boolean
  errors: ValidationError[]
  summary: Record<string, unknown>
} | null

export function ProtocolRuntimeGenerationClient(props: {
  organizationId: string
  initialStudyId?: string | null
  initialVersionId?: string | null
}) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    props.initialVersionId ?? null,
  )
  const [studyId, setStudyId] = useState<string>(props.initialStudyId ?? '')
  const [runs, setRuns] = useState<ProtocolRuntimeGenerationRunRow[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<ReadinessState>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshKeyState = useState(0)
  const refreshKey = refreshKeyState[0]
  const setRefreshKey = refreshKeyState[1]
  const refresh = useCallback(() => setRefreshKey((v) => v + 1), [setRefreshKey])

  useEffect(() => {
    const versionId = selectedVersionId
    if (!versionId) return
    let cancelled = false
    async function loadRuns(activeVersionId: string) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/protocol-runtime-generation/runs?organization_id=${encodeURIComponent(props.organizationId)}&protocol_version_id=${encodeURIComponent(activeVersionId)}`,
        )
        const data = (await res.json()) as { runs?: ProtocolRuntimeGenerationRunRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to list runs')
        if (!cancelled) {
          setRuns(data.runs ?? [])
          setSelectedRunId((current) => current ?? data.runs?.[0]?.id ?? null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to list runs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadRuns(versionId)
    return () => {
      cancelled = true
    }
  }, [props.organizationId, refreshKey, selectedVersionId])

  const latestRun = runs[0] ?? null

  const preview = useMemo(() => {
    if (!readiness?.summary) return null
    return {
      approvedVisits: Number(readiness.summary.approved_visits ?? readiness.summary.approvedVisits ?? 0),
      approvedProcedures: Number(readiness.summary.approved_procedures ?? readiness.summary.approvedProcedures ?? 0),
      distinctProcedureMappings: Number(readiness.summary.distinct_mappings ?? 0),
    }
  }, [readiness])

  async function validateReadiness() {
    if (!selectedVersionId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-runtime-generation/validate/${encodeURIComponent(selectedVersionId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: props.organizationId }),
        },
      )
      const data = (await res.json()) as {
        error?: string
        result?: { ok: boolean; errors: ValidationError[]; summary: Record<string, unknown> }
      }
      if (!res.ok) throw new Error(data.error || 'Validation failed')
      const result = data.result
      setReadiness({
        ready: Boolean(result?.ok),
        errors: result?.errors ?? [],
        summary: result?.summary ?? {},
      })

      // Best-effort: prefill study_id from summary if present
      const summaryStudyId = (result?.summary?.study_id as string | undefined) ?? ''
      if (summaryStudyId && !studyId) setStudyId(summaryStudyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <GenerationVersionSelector
        organizationId={props.organizationId}
        selectedVersionId={selectedVersionId}
        preselectStudyId={props.initialStudyId}
        preselectVersionId={props.initialVersionId}
        onSelect={(id) => {
          setSelectedVersionId(id)
          setReadiness(null)
          setRuns([])
          setSelectedRunId(null)
        }}
      />

      {selectedVersionId ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <p className="text-sm font-medium text-slate-900">Generation inputs</p>
          <label className="mt-2 block text-xs text-slate-600">
            Study ID (must match protocol runtime study link)
            <input
              className="mt-1 w-full max-w-xl rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={studyId}
              onChange={(e) => setStudyId(e.target.value)}
              placeholder="uuid"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void validateReadiness()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Working…' : 'Validate readiness'}
            </button>
            <GenerateRuntimeButton
              organizationId={props.organizationId}
              protocolVersionId={selectedVersionId}
              studyId={studyId}
              disabled={!readiness?.ready || !studyId}
              onDone={() => {
                refresh()
                void validateReadiness()
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {readiness ? (
        <>
          <GenerationPreviewPanel preview={preview} />
          <GenerationReadinessPanel ready={readiness.ready} errors={readiness.errors} summary={readiness.summary} />
        </>
      ) : null}

      {latestRun ? <GenerationResultSummary run={latestRun} /> : null}

      <SourcePackageHandoff
        generated={latestRun?.generationStatus === GENERATION_STATUS.GENERATED}
        studyId={studyId || latestRun?.studyId || ''}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Generation runs</h2>
        {loading && !runs.length ? <p className="text-sm text-slate-500">Loading runs…</p> : null}
        <GenerationRunList runs={runs} selectedRunId={selectedRunId} onSelect={setSelectedRunId} />
      </section>
    </div>
  )
}

function SourcePackageHandoff(props: { generated: boolean; studyId: string }) {
  const canContinue = props.generated && props.studyId.length > 0
  const href = `/runtime-source-packages?study_id=${encodeURIComponent(props.studyId)}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Source packages</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {canContinue
            ? 'Runtime composition generated. Continue to build draft source packages from the compiled snapshot.'
            : 'Generate runtime to produce a composition snapshot before building source packages.'}
        </p>
      </div>
      {canContinue ? (
        <Link
          href={href}
          className="inline-flex shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Continue to Source Packages
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex shrink-0 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
        >
          Continue to Source Packages
        </span>
      )}
    </div>
  )
}

