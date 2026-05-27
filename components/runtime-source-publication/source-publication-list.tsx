'use client'

import type { RuntimeSourcePackagePublicationRow } from '@/lib/runtime-source-publication/runtime-source-publication-types'

export function SourcePublicationList(props: {
  publications: RuntimeSourcePackagePublicationRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (props.publications.length === 0) {
    return <p className="text-sm text-slate-500">No published source versions yet.</p>
  }

  return (
    <ul className="space-y-2">
      {props.publications.map((pub) => {
        const selected = pub.id === props.selectedId
        return (
          <li
            key={pub.id}
            className={`group rounded border p-3 text-sm ${
              selected ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => props.onSelect(pub.id)}
              className="text-left font-medium text-slate-900 hover:underline"
            >
              v{pub.publicationVersion} · {pub.publicationStatus}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              package {pub.sourcePackageId.slice(0, 8)}… · hash {pub.packageHash.slice(0, 12)}…
            </p>
            <p className="mt-1 text-xs text-slate-500">
              published {new Date(pub.publishedAt).toLocaleString()}
              {pub.supersedesPublicationId ? ` · supersedes ${pub.supersedesPublicationId.slice(0, 8)}…` : ''}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

