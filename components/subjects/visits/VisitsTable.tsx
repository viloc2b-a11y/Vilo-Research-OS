import { VisitRow } from '@/components/subjects/visits/VisitRow'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

type VisitsTableProps = {
  visits: SubjectVisitGridRow[]
}

export function VisitsTable({ visits }: VisitsTableProps) {
  if (visits.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No visits on record. Set enrollment to enrolled or randomized to auto-generate the
        protocol schedule, or add visits via study provisioning.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5">Visit</th>
            <th className="px-3 py-2.5">Protocol</th>
            <th className="px-3 py-2.5">Arm</th>
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5">EDC status</th>
            <th className="px-3 py-2.5">QC status</th>
            <th className="px-3 py-2.5">Review status</th>
            <th className="px-3 py-2.5">Workflow</th>
            <th className="px-3 py-2.5">Visit status</th>
            <th className="px-3 py-2.5">Subject payment</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((row) => (
            <VisitRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
