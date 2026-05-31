'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { RuntimeSourcePackageRow } from '@/lib/runtime-source-package/source-package-types'
import { RuntimeSourcePackageGenerator } from './runtime-source-package-generator'
import { RuntimeSourcePackageList } from './runtime-source-package-list'
import { RuntimeSourcePackageReview } from './runtime-source-package-review'

type StudyOption = { id: string; name: string }
type SnapshotOption = { id: string; graphHash: string; createdAt: string }

type RuntimeSourcePackageClientProps = {
  organizationId: string
  studies: StudyOption[]
  snapshotsByStudy: Record<string, SnapshotOption[]>
  initialStudyId?: string | null
}

function PackageListLoader({
  organizationId,
  studyId,
  refreshKey,
  selectedId,
  onSelect,
}: {
  organizationId: string
  studyId: string
  refreshKey: number
  selectedId: string | null
  onSelect: (packageId: string) => void
}) {
  const [packages, setPackages] = useState<RuntimeSourcePackageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studyId) {
        setPackages([])
        setLoading(false)
        return
      }
      try {
        const res = await fetch(
          `/api/runtime-source-packages?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
        )
        const data = (await res.json()) as { packages?: RuntimeSourcePackageRow[] }
        if (!cancelled) setPackages(data.packages ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, studyId, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading packages…</p>
  return <RuntimeSourcePackageList packages={packages} selectedId={selectedId} onSelect={onSelect} />
}

export function RuntimeSourcePackageClient({
  organizationId,
  studies,
  snapshotsByStudy,
  initialStudyId,
}: RuntimeSourcePackageClientProps) {
  const preselected =
    initialStudyId && studies.some((s) => s.id === initialStudyId) ? initialStudyId : null
  const [studyId, setStudyId] = useState(preselected ?? studies[0]?.id ?? '')
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <RuntimeSourcePackageGenerator
        organizationId={organizationId}
        studies={studies}
        snapshotsByStudy={snapshotsByStudy}
        onGenerated={(packageId) => {
          setSelectedPackageId(packageId)
          setRefreshKey((value) => value + 1)
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          View packages for
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={studyId}
            onChange={(e) => {
              setStudyId(e.target.value)
              setSelectedPackageId(null)
            }}
          >
            {studies.map((study) => (
              <option key={study.id} value={study.id}>{study.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <PackageListLoader
          organizationId={organizationId}
          studyId={studyId}
          refreshKey={refreshKey}
          selectedId={selectedPackageId}
          onSelect={setSelectedPackageId}
        />
        {selectedPackageId ? (
          <RuntimeSourcePackageReview
            key={`${selectedPackageId}-${refreshKey}`}
            organizationId={organizationId}
            packageId={selectedPackageId}
            refreshKey={refreshKey}
            onReviewed={() => setRefreshKey((value) => value + 1)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
            Select a source package to review visit and procedure shells.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Publication</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {selectedPackageId
              ? 'Reviewed the package? Continue to publish an approved source version and generate signature placeholders.'
              : 'Select a reviewed source package to continue to publication.'}
          </p>
        </div>
        {selectedPackageId && studyId ? (
          <Link
            href={`/runtime-source-publication?study_id=${encodeURIComponent(studyId)}`}
            className="inline-flex shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Continue to Publication
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex shrink-0 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
          >
            Continue to Publication
          </span>
        )}
      </div>
    </div>
  )
}
