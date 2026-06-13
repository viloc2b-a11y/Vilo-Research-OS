import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  SubjectLabTestEntry,
} from '@/lib/longitudinal-labs/longitudinal-lab-types'
import { LabSignalBadge } from './lab-signal-badge'

function formatValue(value: number | null, unit: string | null): string {
  if (value == null) return '—'
  return unit ? `${value} ${unit}` : String(value)
}

function formatRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return '—'
  if (low == null) return `≤ ${high}`
  if (high == null) return `≥ ${low}`
  return `${low} – ${high}`
}

function formatChange(value: number | null, pct: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  const pctStr = pct != null ? ` (${sign}${pct.toFixed(1)}%)` : ''
  return `${sign}${value}${pctStr}`
}

function LabTestRow({ entry }: { entry: SubjectLabTestEntry }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{entry.labTestName}</h4>
          <span className="text-xs text-muted-foreground">
            ({entry.labTestCode})
          </span>
          {entry.signals.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {entry.signals.map((signal, idx) => (
                <LabSignalBadge key={`${signal.kind}-${idx}`} signal={signal} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Latest:</span>{' '}
            <span className="font-medium">
              {formatValue(
                entry.latestResult?.resultValue ?? null,
                entry.latestResult?.resultUnit ?? null,
              )}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Reference:</span>{' '}
            {formatRange(
              entry.latestResult?.referenceLow ?? null,
              entry.latestResult?.referenceHigh ?? null,
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Baseline:</span>{' '}
            {formatValue(
              entry.baselineResult?.resultValue ?? null,
              entry.baselineResult?.resultUnit ?? null,
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Change:</span>{' '}
            {formatChange(
              entry.changeFromBaseline,
              entry.percentChangeFromBaseline,
            )}
          </div>
        </div>

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{entry.resultCount} result{entry.resultCount !== 1 ? 's' : ''}</span>
          {entry.latestResult?.collectionDate ? (
            <span>Last: {new Date(entry.latestResult.collectionDate).toLocaleDateString()}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function SubjectLabTimeline({
  tests,
}: {
  tests: SubjectLabTestEntry[]
}) {
  if (tests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Labs</CardTitle>
          <CardDescription>
            No lab results recorded for this subject.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Labs</h2>
        <p className="text-sm text-muted-foreground">
          Longitudinal lab results with automated signal detection.
        </p>
      </div>

      <div className="space-y-3">
        {tests.map((entry) => (
          <LabTestRow key={entry.labTestCode} entry={entry} />
        ))}
      </div>
    </div>
  )
}
