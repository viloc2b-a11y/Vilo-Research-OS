'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProtocolRuntimeVersionRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'
import {
  resolveAutoSelectVersion,
  type AutoSelectStudy,
} from '@/lib/protocol-intake-runtime/resolve-auto-select-version'

export function GenerationVersionSelector(props: {
  organizationId: string
  selectedVersionId: string | null
  preselectStudyId?: string | null
  preselectVersionId?: string | null
  onSelect: (versionId: string) => void
}) {
  const { organizationId, selectedVersionId, preselectStudyId, preselectVersionId, onSelect } = props
  const [versions, setVersions] = useState<ProtocolRuntimeVersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/protocol-intake-runtime/studies?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as { studies?: AutoSelectStudy[] }
        const studies = data.studies ?? []
        const allVersions: ProtocolRuntimeVersionRow[] = []
        for (const study of studies) {
          const studyRes = await fetch(
            `/api/protocol-intake-runtime/studies/${encodeURIComponent(study.id)}?organization_id=${encodeURIComponent(organizationId)}`,
          )
          const studyData = (await studyRes.json()) as { versions?: ProtocolRuntimeVersionRow[] }
          allVersions.push(...(studyData.versions ?? []))
        }
        if (cancelled) return
        setVersions(allVersions)

        if (!autoSelectedRef.current && !selectedVersionId) {
          const target = resolveAutoSelectVersion({
            allVersions,
            studies,
            preselectVersionId,
            preselectStudyId,
          })
          if (target) {
            autoSelectedRef.current = true
            onSelect(target)
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
  }, [organizationId, onSelect, selectedVersionId, preselectStudyId, preselectVersionId])

  if (loading) return <p className="text-sm text-slate-500">Loading protocol versions…</p>

  return (
    <label className="block text-sm text-slate-600">
      Protocol version
      <select
        className="mt-1 w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={selectedVersionId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">Select version</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.versionLabel} · {version.extractionStatus}
          </option>
        ))}
      </select>
    </label>
  )
}

