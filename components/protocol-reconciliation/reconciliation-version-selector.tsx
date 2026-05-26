'use client'

import { useEffect, useState } from 'react'
import type { ProtocolRuntimeVersionRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export function ReconciliationVersionSelector(props: {
  organizationId: string
  selectedVersionId: string | null
  onSelect: (versionId: string) => void
}) {
  const { organizationId, selectedVersionId, onSelect } = props
  const [versions, setVersions] = useState<ProtocolRuntimeVersionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/protocol-intake-runtime/studies?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as {
          studies?: Array<{ id: string; currentProtocolVersionId: string | null }>
        }
        const studyIds = (data.studies ?? []).map((s) => s.id)
        const allVersions: ProtocolRuntimeVersionRow[] = []
        for (const studyId of studyIds) {
          const studyRes = await fetch(
            `/api/protocol-intake-runtime/studies/${encodeURIComponent(studyId)}?organization_id=${encodeURIComponent(organizationId)}`,
          )
          const studyData = (await studyRes.json()) as { versions?: ProtocolRuntimeVersionRow[] }
          allVersions.push(...(studyData.versions ?? []))
        }
        if (!cancelled) {
          setVersions(allVersions)
          if (!selectedVersionId && allVersions[0]?.id) {
            onSelect(allVersions[0].id)
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
  }, [organizationId, onSelect, selectedVersionId])

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
