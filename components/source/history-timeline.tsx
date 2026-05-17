import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { HistoryTimelineViewModel } from '@/lib/source/read-contract/view-models'

type HistoryTimelineProps = {
  model: HistoryTimelineViewModel
}

export function HistoryTimeline({ model }: HistoryTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">History timeline</CardTitle>
        <CardDescription>
          Immutable chronology from GET /history ({model.eventCount} events) — order preserved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {model.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{model.emptyMessage}</p>
        ) : (
          <ol className="relative space-y-0 border-l border-border pl-4">
            {model.events.map((evt) => (
              <li key={evt.id} className="pb-6 last:pb-0">
                <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                <p className="text-xs text-muted-foreground">{evt.occurredAtDisplay}</p>
                <p className="text-sm font-medium">{evt.kindLabel}</p>
                {evt.actorDisplay ? (
                  <p className="text-xs text-muted-foreground">Actor {evt.actorDisplay}</p>
                ) : null}
                {evt.payloadDisplay ? (
                  <pre className="mt-2 max-h-32 overflow-auto rounded border bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                    {evt.payloadDisplay}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
