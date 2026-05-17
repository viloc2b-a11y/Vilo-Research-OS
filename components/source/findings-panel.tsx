import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FindingRowActions } from '@/components/source/finding-row-actions'
import { FindingsFilterBar } from '@/components/source/findings-filter-bar'
import { severityTextClass } from '@/lib/source/read-contract/format'
import type { FindingsPanelViewModel } from '@/lib/source/read-contract/view-models'

type FindingsPanelProps = {
  model: FindingsPanelViewModel
  organizationId: string
  responseSetId: string
}

export function FindingsPanel({ model, organizationId, responseSetId }: FindingsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Findings</CardTitle>
        <CardDescription>
          {model.summaryLabel} — lifecycle from API; actions call write routes only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FindingsFilterBar filters={model.filters} />

        {model.findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{model.emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border">
            {model.findings.map((f) => (
              <li key={f.id} className="space-y-2 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-medium ${severityTextClass(f.severityTone)}`}>
                    {f.severityLabel}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{f.statusLabel}</span>
                  <span className="text-xs text-muted-foreground">{f.typeLabel}</span>
                </div>
                <p>{f.message}</p>
                <p className="text-xs text-muted-foreground">{f.ruleMeta}</p>
                {f.resolutionMeta ? (
                  <p className="text-xs text-muted-foreground">{f.resolutionMeta}</p>
                ) : null}

                {f.timeline.length > 0 ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Lifecycle timeline ({f.timeline.length})
                    </summary>
                    <ol className="mt-2 space-y-1 border-l border-border pl-3">
                      {f.timeline.map((entry) => (
                        <li key={entry.id}>{entry.line}</li>
                      ))}
                    </ol>
                  </details>
                ) : null}

                <FindingRowActions
                  finding={f}
                  organizationId={organizationId}
                  responseSetId={responseSetId}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
