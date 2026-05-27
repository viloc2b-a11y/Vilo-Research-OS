'use client'

import { useEffect, useState } from 'react'
import type { BlueprintLineageCandidate } from '@/lib/source-blueprint-evidence/source-lineage-types'
import type { SourceBlueprintEvidenceLineageRow } from '@/lib/source-blueprint-evidence/source-lineage-types'
import {
  LINEAGE_ELEMENT_LABELS,
  TRACE_ORIGIN,
  TRACE_ORIGIN_LABELS,
  type LineageElementType,
  type TraceOrigin,
} from '@/lib/source-blueprint-evidence/source-lineage-types'

export type LineageDraft = {
  elementType: LineageElementType
  elementKey: string
  elementLabel: string
  traceOrigin: TraceOrigin
}

function draftsFromLineage(existingLineage: SourceBlueprintEvidenceLineageRow[]): LineageDraft[] {
  return existingLineage.map((row) => ({
    elementType: row.elementType,
    elementKey: row.elementKey,
    elementLabel: row.elementLabel ?? row.elementKey,
    traceOrigin: row.traceOrigin,
  }))
}

type EvidenceLineageMappingProps = {
  organizationId: string
  studyId: string
  blueprintVersionId: string
  suggestedTraceOrigin: TraceOrigin
  existingLineage: SourceBlueprintEvidenceLineageRow[]
  disabled?: boolean
  onChange: (drafts: LineageDraft[]) => void
}

export function EvidenceLineageMapping({
  organizationId,
  studyId,
  blueprintVersionId,
  suggestedTraceOrigin,
  existingLineage,
  disabled,
  onChange,
}: EvidenceLineageMappingProps) {
  const [candidates, setCandidates] = useState<BlueprintLineageCandidate[]>([])
  const [selected, setSelected] = useState<LineageDraft[]>(() =>
    draftsFromLineage(existingLineage),
  )
  const [loading, setLoading] = useState(false)

  function emit(next: LineageDraft[]) {
    setSelected(next)
    onChange(next)
  }

  useEffect(() => {
    if (!blueprintVersionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          organization_id: organizationId,
          study_id: studyId,
          blueprint_version_id: blueprintVersionId,
        })
        const res = await fetch(`/api/source-blueprint-evidence/mapping-candidates?${params}`)
        const data = (await res.json()) as { candidates?: BlueprintLineageCandidate[] }
        if (!cancelled) setCandidates(data.candidates ?? [])
      } catch {
        if (!cancelled) setCandidates([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, blueprintVersionId])

  function toggleCandidate(candidate: BlueprintLineageCandidate) {
    const key = `${candidate.elementType}:${candidate.elementKey}`
    const exists = selected.some((s) => `${s.elementType}:${s.elementKey}` === key)
    const next = exists
      ? selected.filter((s) => `${s.elementType}:${s.elementKey}` !== key)
      : [
          ...selected,
          {
            elementType: candidate.elementType,
            elementKey: candidate.elementKey,
            elementLabel: candidate.elementLabel,
            traceOrigin: suggestedTraceOrigin,
          },
        ]
    emit(next)
  }

  function updateTraceOrigin(
    elementType: LineageElementType,
    elementKey: string,
    traceOrigin: TraceOrigin,
  ) {
    emit(
      selected.map((row) =>
        row.elementType === elementType && row.elementKey === elementKey
          ? { ...row, traceOrigin }
          : row,
      ),
    )
  }

  if (!blueprintVersionId) {
    return (
      <p className="text-xs text-slate-500">
        Select a procedure library entry to map evidence to blueprint elements.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Map Evidence to blueprint sections, fields, rules, and instructions. Blueprint changes
        require a separate manual update in Source Builder. No runtime changes occur automatically.
      </p>
      {loading ? <p className="text-xs text-slate-400">Loading blueprint elements…</p> : null}
      <div className="vilo-scroll-contained max-h-48 space-y-1 overflow-y-auto rounded border border-slate-100 p-2">
        {candidates.map((candidate) => {
          const key = `${candidate.elementType}:${candidate.elementKey}`
          const isSelected = selected.some((s) => `${s.elementType}:${s.elementKey}` === key)
          const draft = selected.find((s) => `${s.elementType}:${s.elementKey}` === key)
          return (
            <div
              key={key}
              className="group rounded border border-transparent px-1 py-1 hover:border-slate-100"
            >
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => toggleCandidate(candidate)}
                />
                <span>
                  <span className="font-medium text-slate-700">
                    {LINEAGE_ELEMENT_LABELS[candidate.elementType]}
                  </span>
                  <span className="text-slate-600"> · {candidate.elementLabel}</span>
                </span>
              </label>
              {isSelected && draft ? (
                <select
                  className="mt-1 ml-5 w-[calc(100%-1.25rem)] rounded border border-slate-200 px-1 py-0.5 text-xs"
                  value={draft.traceOrigin}
                  disabled={disabled}
                  onChange={(e) =>
                    updateTraceOrigin(
                      candidate.elementType,
                      candidate.elementKey,
                      e.target.value as TraceOrigin,
                    )
                  }
                >
                  {Object.values(TRACE_ORIGIN).map((origin) => (
                    <option key={origin} value={origin}>
                      {TRACE_ORIGIN_LABELS[origin]}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )
        })}
        {!loading && candidates.length === 0 ? (
          <p className="text-xs text-slate-400">No mappable elements in this blueprint version.</p>
        ) : null}
      </div>
    </div>
  )
}
