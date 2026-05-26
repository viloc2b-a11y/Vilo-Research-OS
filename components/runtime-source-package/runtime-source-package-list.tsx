'use client'

import type { RuntimeSourcePackageRow } from '@/lib/runtime-source-package/source-package-types'

type RuntimeSourcePackageListProps = {
  packages: RuntimeSourcePackageRow[]
  selectedId: string | null
  onSelect: (packageId: string) => void
}

export function RuntimeSourcePackageList({
  packages,
  selectedId,
  onSelect,
}: RuntimeSourcePackageListProps) {
  if (packages.length === 0) {
    return <p className="text-sm text-slate-500">No source packages generated yet.</p>
  }

  return (
    <div className="space-y-2">
      {packages.map((pkg) => (
        <button
          key={pkg.id}
          type="button"
          onClick={() => onSelect(pkg.id)}
          className={`w-full rounded-md border p-3 text-left text-sm transition ${
            selectedId === pkg.id
              ? 'border-indigo-300 bg-indigo-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="font-medium text-slate-800">{pkg.packageName}</div>
          <div className="mt-1 text-xs text-slate-500">
            v{pkg.packageVersion} · {pkg.packageStatus} · hash {pkg.packageHash.slice(0, 12)}…
          </div>
        </button>
      ))}
    </div>
  )
}
