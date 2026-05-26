'use client'

import { useEffect, useState } from 'react'
import type { LoadedProtocolVersion, ProtocolRuntimeVersionRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'
import { RunProtocolExtractionButton } from './run-protocol-extraction-button'
import { ProtocolSectionList } from './protocol-section-list'
import { VisitCandidateList } from './visit-candidate-list'
import { ProcedureCandidateList } from './procedure-candidate-list'
import { AmendmentLineagePanel } from './amendment-lineage-panel'

export function ProtocolVersionPanel(props: {
  organizationId: string
  version: ProtocolRuntimeVersionRow
  refreshKey: number
  onRefresh: () => void
}) {
  const [loaded, setLoaded] = useState<LoadedProtocolVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/protocol-intake-runtime/versions/${encodeURIComponent(props.version.id)}?organization_id=${encodeURIComponent(props.organizationId)}`,
        )
        const data = (await res.json()) as (LoadedProtocolVersion & { error?: string })
        if (!res.ok) throw new Error(data.error || 'Failed to load protocol version')
        if (!cancelled) setLoaded(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load version')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.organizationId, props.version.id, props.refreshKey])

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{props.version.versionLabel}</h2>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {props.version.extractionStatus}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Version {props.version.id.slice(0, 8)}… · Source document {props.version.sourceDocumentId.slice(0, 8)}…
        </p>
        <div className="mt-3">
          <RunProtocolExtractionButton
            organizationId={props.organizationId}
            versionId={props.version.id}
            onDone={props.onRefresh}
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Extraction notes</p>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
          {JSON.stringify(props.version.extractionMetadata, null, 2)}
        </pre>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading extracted artifacts…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loaded ? (
        <>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Sections</h3>
            <ProtocolSectionList sections={loaded.sections} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Visit candidates</h3>
            <VisitCandidateList visits={loaded.visitCandidates} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Procedure candidates</h3>
            <ProcedureCandidateList procedures={loaded.procedureCandidates} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Amendment lineage</h3>
            <AmendmentLineagePanel links={loaded.amendmentLinks} />
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Run extraction to generate sections and candidates for review.
        </p>
      )}
    </div>
  )
}

