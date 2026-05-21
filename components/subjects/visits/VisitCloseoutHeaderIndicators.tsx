import Link from 'next/link'
import { PenTool } from 'lucide-react'
import type { VisitCloseoutBundle } from '@/lib/subject/visits/progress-note/types'

export type VisitCloseoutHeaderChip = {
  id: string
  label: string
}

export function deriveVisitCloseoutHeaderChips(
  bundle: VisitCloseoutBundle | null,
): VisitCloseoutHeaderChip[] {
  if (!bundle || bundle.closeoutLocked) return []

  const chips: VisitCloseoutHeaderChip[] = []
  if (bundle.model.coordinatorSignatureStatus !== 'signed') {
    chips.push({ id: 'coordinator', label: 'Coordinator closeout pending' })
  } else if (bundle.model.investigatorReviewStatus !== 'signed') {
    chips.push({ id: 'investigator', label: 'PI / Sub-I signature pending' })
  }
  return chips
}

type VisitCloseoutHeaderIndicatorsProps = {
  chips: VisitCloseoutHeaderChip[]
  workflowHref: string
}

export function VisitCloseoutHeaderIndicators({
  chips,
  workflowHref,
}: VisitCloseoutHeaderIndicatorsProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-800"
        >
          <PenTool className="h-3 w-3 flex-shrink-0" />
          {chip.label}
        </span>
      ))}
      <Link
        href={workflowHref}
        className="text-[10px] font-medium text-primary hover:underline"
      >
        Open Workflow →
      </Link>
    </div>
  )
}
