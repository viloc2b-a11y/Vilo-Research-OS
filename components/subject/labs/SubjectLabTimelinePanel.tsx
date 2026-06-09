import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SubjectLabTimelineItem } from '@/lib/subject/lab-timeline/load-subject-lab-timeline'
import type { LongitudinalLabRuntime } from '@/lib/subject/lab-timeline/types'

type SubjectLabTimelinePanelProps = {
  runtime: LongitudinalLabRuntime | null
  items: SubjectLabTimelineItem[]
  loadError: string | null
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined) return '—'
  return typeof value === 'number'
    ? Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/\.?0+$/, '')
    : String(value)
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${rounded >= 0 ? '+' : ''}${rounded}%`
}

function severityClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

export function SubjectLabTimelinePanel({ runtime, items, loadError }: SubjectLabTimelinePanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Longitudinal Lab Runtime</CardTitle>
          <CardDescription>
            Structured lab trends derived from existing source responses. CRC-uploaded lab documents
            flow through Document Center / visit document intake and then appear here as
            operational intelligence only, not medical diagnosis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : runtime ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Series</p>
                  <p className="mt-1 text-lg font-semibold">{runtime.summary.observedSeries}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Signals</p>
                  <p className="mt-1 text-lg font-semibold">{runtime.summary.signalCount}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Critical</p>
                  <p className="mt-1 text-lg font-semibold">{runtime.summary.criticalSignalCount}</p>
                </div>
              </div>

              {runtime.series.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Trend series</h3>
                  <div className="space-y-3">
                    {runtime.series.map((series) => (
                      <div key={series.seriesKey} className="rounded-lg border bg-background p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{series.labName}</p>
                            <p className="text-xs text-muted-foreground">
                              {series.labCategory}
                              {series.visitLabel ? ` · ${series.visitLabel}` : ''}
                              {series.visitCode ? ` · ${series.visitCode}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border px-2 py-1 text-xs font-medium">
                            Trend: {series.trendState}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">{series.trendReason}</p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Baseline</p>
                            <p className="font-medium">
                              {formatValue(series.baselineValue)} {series.unit ?? ''}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(series.baselineDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Previous</p>
                            <p className="font-medium">
                              {formatValue(series.previousValue)} {series.unit ?? ''}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(series.previousDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Current</p>
                            <p className="font-medium">
                              {formatValue(series.currentValue)} {series.unit ?? ''}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(series.currentDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Change</p>
                            <p className="font-medium">
                              {formatValue(series.deltaBaseline)} / {formatPercent(series.percentChangeBaseline)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Delta vs previous: {formatValue(series.deltaPrevious)} /{' '}
                              {formatPercent(series.percentChangePrevious)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {series.referenceRange ? (
                            <span className="rounded-full border px-2 py-1 text-muted-foreground">
                              Ref {series.referenceRange}
                            </span>
                          ) : null}
                          {series.latestAbnormal ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                              Latest abnormal
                            </span>
                          ) : null}
                          <span className="rounded-full border px-2 py-1 text-muted-foreground">
                            {series.abnormalCount} abnormal in a row
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No structured lab series were derived from the current source data yet.
                </p>
              )}

              {runtime.signals.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Operational signals</h3>
                  <ul className="space-y-2">
                    {runtime.signals.map((signal) => (
                      <li key={`${signal.kind}:${signal.seriesKey}:${signal.visitLabel}`} className={`rounded-lg border p-3 text-sm ${severityClass(signal.severity)}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{signal.title}</p>
                            <p className="text-xs opacity-80">{signal.reason}</p>
                          </div>
                          <span className="rounded-full border px-2 py-1 text-xs font-medium capitalize">
                            {signal.severity}
                          </span>
                        </div>
                        <p className="mt-2 text-xs opacity-80">
                          {signal.visitLabel}
                          {signal.linkedObjectHref ? (
                            <>
                              {' '}
                              · <a className="underline" href={signal.linkedObjectHref}>Open linked visit</a>
                            </>
                          ) : null}
                        </p>
                        <p className="mt-2 text-xs font-medium">Recommended next step: {signal.recommendedNextStep}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No longitudinal lab runtime could be derived from the current source data yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lab Document Chronology</CardTitle>
          <CardDescription>
            Visit-linked lab documents ordered chronologically. This is the source record created
            when the CRC scans and uploads lab documents through the document intake flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 ? (
            <ol className="space-y-2">
              {items.map((item, index) => (
                <li key={item.documentId} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {index + 1}. {item.visitLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.visitDate)} · Uploaded {formatDate(item.uploadedAt)}
                        {item.visitCode ? ` · ${item.visitCode}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {item.previewUrl ? (
                        <a href={item.previewUrl} target="_blank" rel="noreferrer" className="underline">
                          Preview
                        </a>
                      ) : null}
                      {item.downloadUrl ? (
                        <a href={item.downloadUrl} className="underline">
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="font-medium text-foreground">{item.fileName}</p>
                    {item.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lab document attached to this visit.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              No longitudinal lab documents have been uploaded for this subject yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
