import type { RuntimeReadinessContinuityRow } from '@/lib/studies/runtime-readiness'
import { OperationalTableScroll } from '@/components/runtime-ui/OperationalTableScroll'

type StudyVisitSourceContinuityPanelProps = {
  rows: RuntimeReadinessContinuityRow[]
  /** When nested inside Execution Readiness, omit outer card chrome. */
  embedded?: boolean
}

function ContinuityTableBody({ rows }: { rows: RuntimeReadinessContinuityRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No required visit/procedure/source rows are available to validate.
      </p>
    )
  }

  return (
    <OperationalTableScroll
      id="study-visit-source-continuity-scroll"
      minTableWidth={960}
      className="rounded-md border border-border"
    >
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Visit</th>
            <th className="px-3 py-2 font-medium">Required Procedure</th>
            <th className="px-3 py-2 font-medium">Published Source Bound?</th>
            <th className="px-3 py-2 font-medium">Executable?</th>
            <th className="px-3 py-2 font-medium">Blocker</th>
            <th className="px-3 py-2 font-medium">Next Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.severity === 'blocker' ? 'bg-red-50/70 dark:bg-red-950/20' : undefined}
            >
              <td className="px-3 py-2 font-medium text-foreground">{row.visitLabel}</td>
              <td className="px-3 py-2 text-foreground">{row.procedureLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.bindingState}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.executableState}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.blocker}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </OperationalTableScroll>
  )
}

export function StudyVisitSourceContinuityPanel({
  rows,
  embedded = false,
}: StudyVisitSourceContinuityPanelProps) {
  if (embedded) {
    return (
      <div id="study-visit-source-continuity" className="min-w-0 w-full max-w-none space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Visit to Procedure to Source Continuity
        </h3>
        <ContinuityTableBody rows={rows} />
      </div>
    )
  }

  return (
    <section
      id="study-visit-source-continuity"
      className="min-w-0 w-full max-w-none rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Visit to Procedure to Source Continuity
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Required visit procedures and whether published source is bound and executable.
        </p>
      </div>

      <div className="p-4">
        <ContinuityTableBody rows={rows} />
      </div>
    </section>
  )
}
