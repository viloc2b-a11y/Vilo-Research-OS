'use client'

import { useEffect, useState } from 'react'
import type { SourceBlueprintEvidenceRow } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import { EVIDENCE_KIND_LABELS } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'

type EvidenceListPanelProps = {
  organizationId: string
  studyId: string
  statusFilter: string | null
  refreshKey: number
  selectedId: string | null
  onSelect: (id: string) => void
}

export function EvidenceListPanel({
  organizationId,
  studyId,
  statusFilter,
  refreshKey,
  selectedId,
  onSelect,
}: EvidenceListPanelProps) {
  const [items, setItems] = useState<SourceBlueprintEvidenceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          organization_id: organizationId,
          study_id: studyId,
        })
        if (statusFilter) params.set('evidence_status', statusFilter)
        const res = await fetch(`/api/source-blueprint-evidence?${params.toString()}`)
        const data = (await res.json()) as { evidence?: SourceBlueprintEvidenceRow[] }
        if (!cancelled) setItems(data.evidence ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, statusFilter, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading evidence…</p>

  return (
    <div className="vilo-scroll-contained max-h-[50vh] rounded-md border border-slate-200 bg-white">
      <ul className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-slate-500">No evidence items for this filter.</li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  selectedId === item.id ? 'bg-slate-50 vilo-surface-active' : ''
                }`}
                onClick={() => onSelect(item.id)}
              >
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {EVIDENCE_KIND_LABELS[item.evidenceKind]} · {item.evidenceStatus}
                  {item.evidenceStatus === 'pending_review' ? (
                    <span className="ml-1 text-amber-700">· Coordinator Review Required</span>
                  ) : null}
                </p>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
