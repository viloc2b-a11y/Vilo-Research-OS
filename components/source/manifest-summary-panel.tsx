import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { ManifestViewModel } from '@/lib/source/read-contract/view-models'

type ManifestSummaryPanelProps = {
  model: ManifestViewModel
}

export function ManifestSummaryPanel({ model }: ManifestSummaryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Operational manifest</CardTitle>
        <CardDescription>
          Lightweight status from canonical read API — no field payloads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {model.headlineStats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {model.countStats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-medium">{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
