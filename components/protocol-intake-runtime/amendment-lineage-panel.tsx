'use client'

import type { ProtocolRuntimeAmendmentLinkRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export function AmendmentLineagePanel(props: { links: ProtocolRuntimeAmendmentLinkRow[] }) {
  if (props.links.length === 0) {
    return <p className="text-sm text-slate-500">No amendment lineage recorded yet.</p>
  }

  return (
    <ul className="space-y-2">
      {props.links.map((link) => (
        <li key={link.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
          <div className="font-medium text-slate-900">{link.amendmentType}</div>
          <div className="mt-1 text-xs text-slate-500">
            {link.previousProtocolVersionId.slice(0, 8)}… → {link.newProtocolVersionId.slice(0, 8)}…
          </div>
          {link.amendmentSummary ? (
            <p className="mt-1 text-xs text-slate-600">{link.amendmentSummary}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

