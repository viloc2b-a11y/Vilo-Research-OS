import type { EvidenceRef } from '@/lib/protocol-intake/types'
import type { ConfidenceLevel } from '@/lib/protocol-intake/types'

export function EvidenceBlock(props: {
  evidence_refs: EvidenceRef[]
  confidence?: ConfidenceLevel
  extraction_method?: string
  requires_human_review: boolean
}) {
  const { evidence_refs, confidence, extraction_method, requires_human_review } = props
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
      <div className="flex flex-wrap gap-2">
        {confidence ? (
          <span className="rounded bg-background px-2 py-0.5 font-medium">
            Confidence: {confidence}
          </span>
        ) : null}
        {extraction_method ? (
          <span className="rounded bg-background px-2 py-0.5 text-muted-foreground">
            Method: {extraction_method.replace(/_/g, ' ')}
          </span>
        ) : null}
        {requires_human_review ? (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-900 dark:text-amber-200">
            Needs review
          </span>
        ) : null}
      </div>
      {evidence_refs.length === 0 ? (
        <p className="text-muted-foreground">No source evidence attached.</p>
      ) : (
        evidence_refs.map((ref, i) => (
          <div key={`${ref.file_name}-${i}`} className="space-y-1 border-t border-border/40 pt-2 first:border-0 first:pt-0">
            <p className="font-medium text-foreground">
              {ref.file_name} · {ref.page_or_sheet}
              {ref.section_reference ? ` · ${ref.section_reference}` : ''}
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">{ref.source_snippet}</p>
          </div>
        ))
      )}
    </div>
  )
}
