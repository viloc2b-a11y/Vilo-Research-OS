import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SubjectCloseoutReadiness } from '@/lib/subject/closeout/types'

function severityIcon(severity: SubjectCloseoutReadiness['items'][number]['severity']) {
  switch (severity) {
    case 'pass':
      return <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
    case 'warning':
      return <AlertTriangle className="size-4 text-yellow-600" aria-hidden />
    default:
      return <CircleAlert className="size-4 text-destructive" aria-hidden />
  }
}

function severityBadge(severity: SubjectCloseoutReadiness['items'][number]['severity']) {
  switch (severity) {
    case 'pass':
      return <Badge variant="outline" className="text-emerald-700 border-emerald-300">Pass</Badge>
    case 'warning':
      return <Badge variant="outline" className="text-yellow-800 border-yellow-400">Review</Badge>
    default:
      return <Badge variant="destructive">Blocker</Badge>
  }
}

type SubjectCloseoutChecklistProps = {
  readiness: SubjectCloseoutReadiness
}

export function SubjectCloseoutChecklist({ readiness }: SubjectCloseoutChecklistProps) {
  const { items, blockerCount, warningCount, canMarkCompleted, canTerminateWithReason } = readiness

  return (
    <Card className={blockerCount > 0 ? 'border-destructive/40' : ''}>
      <CardHeader>
        <CardTitle className="text-lg">Subject closeout checklist</CardTitle>
        <CardDescription>
          Runtime checks before completion, withdrawal, screen fail, or lost to follow-up. Blockers
          must be resolved; review items should be documented in the closeout reason when applicable.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          {blockerCount > 0 ? (
            <Badge variant="destructive">{blockerCount} blocker(s)</Badge>
          ) : (
            <Badge variant="outline" className="text-emerald-700 border-emerald-300">
              No blockers
            </Badge>
          )}
          {warningCount > 0 ? (
            <Badge variant="outline" className="text-yellow-800 border-yellow-400">
              {warningCount} review item(s)
            </Badge>
          ) : null}
          {!canMarkCompleted ? (
            <span className="text-xs text-destructive">Mark Completed disabled until blockers clear.</span>
          ) : null}
          {!canTerminateWithReason ? (
            <span className="text-xs text-destructive">
              Withdraw / LTFU disabled until blockers clear.
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-card px-3 py-2.5"
            >
              <span className="mt-0.5 flex-shrink-0">{severityIcon(item.severity)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  {severityBadge(item.severity)}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                {item.href ? (
                  <Link href={item.href} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                    Open →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
