'use client'

type DownloadSourcePackageButtonProps = {
  organizationId: string
  packageId: string
}

export function DownloadSourcePackageButton({
  organizationId,
  packageId,
}: DownloadSourcePackageButtonProps) {
  const url = `/api/runtime-source-packages/${packageId}/download?organization_id=${encodeURIComponent(organizationId)}`

  return (
    <a
      href={url}
      download
      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Download JSON
    </a>
  )
}
