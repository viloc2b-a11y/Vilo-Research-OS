'use client'

type VisitLockStatusBannerProps = {
  lockStatus: 'unlocked' | 'locked' | 'voided'
  snapshotHash?: string | null
}

export function VisitLockStatusBanner({ lockStatus, snapshotHash }: VisitLockStatusBannerProps) {
  if (lockStatus === 'unlocked') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Visit workspace is unlocked. Complete the visit before locking.
      </div>
    )
  }

  if (lockStatus === 'locked') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">
          This visit has been locked and preserved as an immutable snapshot.
        </p>
        {snapshotHash ? (
          <p className="mt-1 font-mono text-xs text-amber-800">
            Snapshot hash: {snapshotHash}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      Visit lock state is voided.
    </div>
  )
}
