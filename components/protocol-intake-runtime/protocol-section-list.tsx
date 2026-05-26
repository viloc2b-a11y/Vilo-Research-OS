'use client'

import type { ProtocolRuntimeSectionRow } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export function ProtocolSectionList(props: { sections: ProtocolRuntimeSectionRow[] }) {
  if (props.sections.length === 0) {
    return <p className="text-sm text-slate-500">No extracted sections yet.</p>
  }

  return (
    <div className="space-y-2">
      {props.sections.map((section) => (
        <details key={section.id} className="rounded border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm text-slate-800">
            {section.sequenceOrder}. {section.sectionTitle}{' '}
            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {section.sectionType}
            </span>
            {section.requiresReview ? (
              <span className="ml-2 text-xs text-slate-500">review</span>
            ) : null}
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
            {section.extractedText}
          </pre>
        </details>
      ))}
    </div>
  )
}

