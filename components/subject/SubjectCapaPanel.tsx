import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck } from 'lucide-react'
import type { CapaActionRow } from '@/lib/capa-runtime/capa-types'

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  under_review: 'Under Review',
  completed: 'Completed',
  verified: 'Verified',
  closed: 'Closed',
}

const STATUS_CLASSES: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  verified: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-700',
}

// Active = not yet closed or verified
const ACTIVE_STATUSES = new Set(['open', 'in_progress', 'under_review', 'completed'])

type Props = {
  capas: CapaActionRow[]
  studyId: string | null
  subjectId: string
}

export function SubjectCapaPanel({ capas, studyId: _studyId, subjectId: _subjectId }: Props) {
  const activeCapas = capas.filter((c) => ACTIVE_STATUSES.has(c.capaStatus))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4 text-blue-500" />
          CAPA Actions
          {activeCapas.length > 0 && (
            <Badge variant="secondary" className="text-xs">{activeCapas.length} active</Badge>
          )}
          <Link href="/capa" className="ml-auto text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeCapas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active CAPA actions for this subject&apos;s study.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeCapas.map((capa) => (
              <li key={capa.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/capa/${capa.id}`}
                    className="flex-1 truncate font-medium hover:underline"
                  >
                    {capa.rootCauseAnalysis ?? capa.correctiveAction}
                  </Link>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[capa.capaStatus] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {STATUS_LABELS[capa.capaStatus] ?? capa.capaStatus}
                  </span>
                </div>
                {capa.dueDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Due {new Date(capa.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
