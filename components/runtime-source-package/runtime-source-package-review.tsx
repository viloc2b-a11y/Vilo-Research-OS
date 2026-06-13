'use client'

import { useEffect, useState } from 'react'
import type { LoadedRuntimeSourcePackage } from '@/lib/runtime-source-package/source-package-types'
import { ApproveSourcePackageButton } from './approve-source-package-button'
import { DownloadSourcePackageButton } from './download-source-package-button'
import { ReviewSourcePackageButton } from './review-source-package-button'
import { SourceVisitShellCard } from './source-visit-shell-card'

type RuntimeSourcePackageReviewProps = {
  organizationId: string
  packageId: string
  refreshKey?: number
  onReviewed?: () => void
  onApproved?: () => void
}

export function RuntimeSourcePackageReview({
  organizationId,
  packageId,
  refreshKey = 0,
  onReviewed,
  onApproved,
}: RuntimeSourcePackageReviewProps) {
  const [loaded, setLoaded] = useState<LoadedRuntimeSourcePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/runtime-source-packages/${packageId}?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as LoadedRuntimeSourcePackage & {
          package?: LoadedRuntimeSourcePackage['package']
          visitShells?: LoadedRuntimeSourcePackage['visitShells']
          procedureShells?: LoadedRuntimeSourcePackage['procedureShells']
          error?: string
        }
        if (!res.ok) throw new Error(data.error || 'Failed to load package')
        if (!cancelled && data.package) {
          setLoaded({
            package: data.package,
            visitShells: data.visitShells ?? [],
            procedureShells: data.procedureShells ?? [],
          })
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load package')
          setLoaded(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, packageId, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading package…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!loaded) return <p className="text-sm text-slate-500">Package not found.</p>

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{loaded.package.packageName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Version {loaded.package.packageVersion} · {loaded.package.packageStatus}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500" title={loaded.package.packageHash}>
              Package hash: {loaded.package.packageHash}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ReviewSourcePackageButton
              organizationId={organizationId}
              packageId={packageId}
              disabled={loaded.package.packageStatus !== 'draft'}
              onReviewed={onReviewed}
            />
            <ApproveSourcePackageButton
              organizationId={organizationId}
              packageId={packageId}
              disabled={loaded.package.packageStatus !== 'reviewed'}
              onApproved={onApproved}
            />
            <DownloadSourcePackageButton
              organizationId={organizationId}
              packageId={packageId}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loaded.visitShells.map((visitShell) => (
          <SourceVisitShellCard
            key={visitShell.id}
            visitShell={visitShell}
            procedureShells={loaded.procedureShells}
          />
        ))}
      </div>
    </div>
  )
}
