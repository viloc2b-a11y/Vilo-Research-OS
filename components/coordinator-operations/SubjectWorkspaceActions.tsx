import Link from 'next/link'
import {
  Activity,
  Calendar,
  FileText,
  Heart,
  Pill,
  Stethoscope,
} from 'lucide-react'
import { SubjectVisitScheduleAction } from '@/components/coordinator-operations/SubjectVisitScheduleAction'
import {
  subjectAdverseEventsTabPath,
  subjectChartPath,
  subjectClinicalProfilePath,
  subjectConMedsTabPath,
  subjectVisitsPath,
} from '@/lib/ops/paths'

type SubjectWorkspaceActionsProps = {
  studyId: string
  subjectId: string
  organizationId: string
  enrollmentStatus: string | null
  openSourceHref?: string | null
  currentVisitHref?: string | null
}

export function SubjectWorkspaceActions({
  studyId,
  subjectId,
  organizationId,
  enrollmentStatus,
  openSourceHref,
  currentVisitHref,
}: SubjectWorkspaceActionsProps) {
  const chart = subjectChartPath(studyId, subjectId)
  const actions = [
    {
      label: 'Medical history',
      href: subjectClinicalProfilePath(studyId, subjectId),
      icon: Stethoscope,
      detail: 'Add or update conditions on the clinical profile',
    },
    {
      label: 'Concomitant meds',
      href: subjectConMedsTabPath(studyId, subjectId),
      icon: Pill,
      detail: 'Review and update ConMeds',
    },
    {
      label: 'AE / safety',
      href: subjectAdverseEventsTabPath(studyId, subjectId),
      icon: Heart,
      detail: 'Record or review adverse events',
    },
    {
      label: 'Visit schedule',
      href: subjectVisitsPath(studyId, subjectId),
      icon: Calendar,
      detail: 'View scheduled visits and operational grid',
    },
    {
      label: 'Workflow & tasks',
      href: `${chart}?tab=workflow`,
      icon: Activity,
      detail: 'Open tasks, blockers, and closeout steps',
    },
  ]

  return (
    <section className="rounded-lg border border-primary/20 bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">What can I do here now?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Coordinator execution paths for this subject — open a section to enter or update data.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.map(({ label, href, icon: Icon, detail }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex h-full items-start gap-3 rounded-md border px-3 py-3 text-sm transition-colors hover:bg-muted"
            >
              <Icon className="mt-0.5 size-4 flex-shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
              </span>
            </Link>
          </li>
        ))}
        {openSourceHref ? (
          <li>
            <Link
              href={openSourceHref}
              className="flex h-full items-start gap-3 rounded-md border border-primary/30 bg-accent/20 px-3 py-3 text-sm transition-colors hover:bg-accent/40"
            >
              <FileText className="mt-0.5 size-4 flex-shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">Continue source capture</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Resume incomplete source documentation
                </span>
              </span>
            </Link>
          </li>
        ) : null}
        {currentVisitHref ? (
          <li>
            <Link
              href={currentVisitHref}
              className="flex h-full items-start gap-3 rounded-md border px-3 py-3 text-sm transition-colors hover:bg-muted"
            >
              <Calendar className="mt-0.5 size-4 flex-shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">Open active visit</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Return to the visit workspace in progress
                </span>
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
      <div className="mt-4 border-t pt-4">
        <SubjectVisitScheduleAction
          studyId={studyId}
          subjectId={subjectId}
          organizationId={organizationId}
          enrollmentStatus={enrollmentStatus}
        />
      </div>
    </section>
  )
}
