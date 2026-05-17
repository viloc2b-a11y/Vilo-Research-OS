import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldCorrectionPanel } from '@/components/source/field-correction-panel'
import { ResponseSetAddendumPanel } from '@/components/source/response-set-addendum-panel'
import type { DisplayBadge, ResponseSetDetailViewModel } from '@/lib/source/read-contract/view-models'

type ResponseSetDetailProps = {
  model: ResponseSetDetailViewModel
  organizationId: string
  responseSetId: string
  allowCorrections: boolean
  allowAddenda: boolean
}

function Badge({ badge }: { badge: DisplayBadge }) {
  const cls =
    badge.tone === 'warn'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
      : badge.tone === 'info'
        ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100'
        : badge.tone === 'success'
          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
          : 'bg-muted text-muted-foreground'
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{badge.label}</span>
}

export function ResponseSetDetail({
  model,
  organizationId,
  responseSetId,
  allowCorrections,
  allowAddenda,
}: ResponseSetDetailProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Response set</CardTitle>
          <CardDescription>
            Canonical reconstruction — current effective values and immutable history per field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {model.metadataRows.map((row) => (
              <div key={row.label}>
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={row.mono ? 'font-mono text-xs' : 'font-medium'}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {allowAddenda ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Late-entry addendum</CardTitle>
            <CardDescription>
              Post-submit addendum for fields without a current effective value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponseSetAddendumPanel
              organizationId={organizationId}
              responseSetId={responseSetId}
              sourceDefinitionVersionId={model.sourceDefinitionVersionId}
              eligibleFields={model.addendumEligibleFields}
            />
          </CardContent>
        </Card>
      ) : null}

      {model.addenda.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Addenda</CardTitle>
            <CardDescription>Late-entry records from canonical read API.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-md border text-sm">
              {model.addenda.map((a) => (
                <li key={a.id} className="space-y-1 px-3 py-3">
                  <p className="font-medium">{a.fieldLabel}</p>
                  <p className="text-muted-foreground">{a.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.addedAtDisplay} · actor {a.actorDisplay}
                  </p>
                  {a.displayValue ? <p className="font-mono text-xs">{a.displayValue}</p> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Captured fields</CardTitle>
          <CardDescription>
            {model.fieldCount} fields · effective value shown separately from version history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border rounded-md border">
            {model.fields.map((field) => (
              <li key={field.fieldId} className="space-y-3 px-3 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{field.fieldKey}</span>
                  {field.badges.map((badge) => (
                    <Badge key={badge.label} badge={badge} />
                  ))}
                </div>

                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current effective value
                  </p>
                  <p className="mt-1 font-mono text-sm">{field.displayValue}</p>
                  {field.captureMeta ? (
                    <p className="mt-1 text-xs text-muted-foreground">{field.captureMeta}</p>
                  ) : null}
                </div>

                {field.historyVersions.length > 0 ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Version history ({field.historyVersions.length}) — immutable order from API
                    </summary>
                    <ol className="mt-2 space-y-2 border-l border-border pl-3">
                      {field.historyVersions.map((h) => (
                        <li key={h.id}>
                          <p>
                            <span className="font-medium">{h.sequenceLabel}</span>
                            {h.flags.length > 0 ? ` · ${h.flags.join(' · ')}` : ''}
                          </p>
                          <p className="font-mono">{h.displayValue}</p>
                          <p className="text-muted-foreground">{h.capturedAtDisplay}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}

                {allowCorrections && field.currentResponseId ? (
                  <FieldCorrectionPanel
                    field={field}
                    organizationId={organizationId}
                    responseSetId={responseSetId}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {model.corrections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Correction lineage</CardTitle>
            <CardDescription>Append-only corrections — prior values preserved.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-md border text-sm">
              {model.corrections.map((c) => (
                <li key={c.id} className="space-y-2 px-3 py-3">
                  <p className="font-medium">{c.typeLabel}</p>
                  <p>{c.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.correctedAtDisplay} · {c.actorDisplay}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Prior</p>
                      <p className="font-mono text-xs">{c.priorValueDisplay}</p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Corrected</p>
                      <p className="font-mono text-xs">{c.correctedValueDisplay}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
