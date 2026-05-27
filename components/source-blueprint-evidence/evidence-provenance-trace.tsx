'use client'

import Link from 'next/link'
import type { SourceBlueprintEvidenceRow } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import type { SourceBlueprintEvidenceLineageRow } from '@/lib/source-blueprint-evidence/source-lineage-types'
import {
  LINEAGE_ELEMENT_LABELS,
  TRACE_ORIGIN_LABELS,
} from '@/lib/source-blueprint-evidence/source-lineage-types'

type EvidenceProvenanceTraceProps = {
  evidence: SourceBlueprintEvidenceRow
  studyId: string
  lineage: SourceBlueprintEvidenceLineageRow[]
}

export function EvidenceProvenanceTrace({
  evidence,
  studyId,
  lineage,
}: EvidenceProvenanceTraceProps) {
  const docIntelHref = `/document-intelligence?study_id=${encodeURIComponent(studyId)}`

  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
        <h3 className="font-semibold text-slate-800">Provenance Trace</h3>
        <p className="mt-2 text-slate-500">
          Source structure is derived from protocol, guidance, approved reconciliation, runtime
          graph, and coordinator-reviewed evidence mappings — not directly from a PDF.
        </p>
        <dl className="mt-3 space-y-1">
          <div>File: {evidence.provenance.source_filename}</div>
          <div>
            Chunk #{evidence.provenance.chunk_index}
            {evidence.provenance.page_number != null
              ? ` · page ${evidence.provenance.page_number}`
              : ''}
          </div>
          {evidence.provenance.section_title ? (
            <div>Section: {evidence.provenance.section_title}</div>
          ) : null}
          <div>Method: {evidence.provenance.extraction_method}</div>
          {evidence.provenance.source_version_number != null ? (
            <div>
              Document version: v{evidence.provenance.source_version_number}
              {evidence.provenance.source_version_label
                ? ` (${evidence.provenance.source_version_label})`
                : ''}
            </div>
          ) : null}
        </dl>
        <Link
          href={docIntelHref}
          className="mt-2 inline-block font-medium text-teal-700 hover:underline"
        >
          Open Document Intelligence
        </Link>
      </section>

      {lineage.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold text-slate-800">Element lineage</h3>
          <p className="mt-1 text-xs text-slate-500">
            Formalizes why each mapped blueprint element is supported. No runtime changes occur
            automatically.
          </p>
          <ul className="mt-2 space-y-2">
            {lineage.map((row) => (
              <li
                key={row.id}
                className="rounded border border-slate-100 bg-white px-2 py-1.5 text-xs text-slate-600"
              >
                <span className="font-medium text-slate-800">
                  {LINEAGE_ELEMENT_LABELS[row.elementType]} · {row.elementLabel ?? row.elementKey}
                </span>
                <div className="text-slate-500">
                  Trace: {TRACE_ORIGIN_LABELS[row.traceOrigin]}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
