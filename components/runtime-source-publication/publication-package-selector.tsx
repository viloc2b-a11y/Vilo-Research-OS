'use client'

import { useEffect, useState } from 'react'
import type { RuntimeSourcePackageRow } from '@/lib/runtime-source-package/source-package-types'

type StudyOption = { id: string; name: string }

export function PublicationPackageSelector(props: {
  organizationId: string
  studies: StudyOption[]
  studyId: string
  onStudyId: (id: string) => void
  selectedPackageId: string
  onPackageId: (id: string) => void
}) {
  const { organizationId, studyId, selectedPackageId, onPackageId } = props
  const [packages, setPackages] = useState<RuntimeSourcePackageRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studyId) return
      setLoading(true)
      try {
        const res = await fetch(
          `/api/runtime-source-packages?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
        )
        const data = (await res.json()) as { packages?: RuntimeSourcePackageRow[] }
        const approved = (data.packages ?? []).filter((p) => p.packageStatus === 'approved')
        if (!cancelled) {
          setPackages(approved)
          if (!selectedPackageId && approved[0]?.id) {
            onPackageId(approved[0].id)
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
  }, [organizationId, studyId, selectedPackageId, onPackageId])

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Study
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={props.studyId}
            onChange={(e) => props.onStudyId(e.target.value)}
          >
            {props.studies.map((study) => (
              <option key={study.id} value={study.id}>{study.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Approved source package
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={props.selectedPackageId}
            onChange={(e) => props.onPackageId(e.target.value)}
          >
            <option value="">Select package</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                v{pkg.packageVersion} · {pkg.packageName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading approved packages…</p> : null}
      {props.selectedPackageId ? (
        <p className="mt-2 text-xs text-slate-500">
          Selected package {props.selectedPackageId.slice(0, 8)}…
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          No approved packages found for this study.
        </p>
      )}
    </div>
  )
}

