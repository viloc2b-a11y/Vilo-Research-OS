import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import type { ProtocolDeviationRow } from '@/lib/protocol-deviations/deviation-types'

const STATUS_LABELS: Record<string, string> = {
  candidate: 'Candidate',
  pi_review: 'PI Review',
  confirmed: 'Confirmed',
  capa_linked: 'CAPA Linked',
  resolved: 'Resolved',
  open: 'Open',
  under_review: 'Under Review',
  closed: 'Closed',
}

const STATUS_CLASSES: Record<string, string> = {
  candidate: 'bg-slate-100 text-slate-700',
  pi_review: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-orange-100 text-orange-800',
  capa_linked: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  open: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-700',
}

const SEVERITY_CLASSES: Record<string, string> = {
  minor: 'bg-slate-100 text-slate-600',
  major: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
}

const OPEN_STATUSES = new Set(['candidate', 'pi_review', 'confirmed', 'capa_linked', 'open', 'under_review'])

type Props = {
  deviations: ProtocolDeviationRow[]
}

export function SubjectDeviationsPanel({ deviations }: Props) {
  const open = deviations.filter((d) => OPEN_STATUSES.has(d.status))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-500" />
          Protocol Deviations
          {open.length > 0 && (
            <Badge variant="secondary" className="text-xs">{open.length} open</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deviations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No protocol deviations recorded for this subject.</p>
        ) : (
          <ul className="space-y-2">
            {deviations.map((dev) => (
              <li key={dev.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 truncate font-medium">
                    {dev.description.length > 80 ? `${dev.description.slice(0, 80)}…` : dev.description}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[dev.status] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {STATUS_LABELS[dev.status] ?? dev.status}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[dev.severity] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {dev.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {dev.deviationType.replace(/_/g, ' ')}
                  {dev.openedAt && ` · Opened ${new Date(dev.openedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
