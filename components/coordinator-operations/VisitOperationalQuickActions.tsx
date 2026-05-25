import Link from 'next/link'
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Pill,
  Stethoscope,
} from 'lucide-react'
import {
  subjectAdverseEventsTabPath,
  subjectClinicalProfilePath,
  subjectConMedsTabPath,
  visitDetailPath,
} from '@/lib/ops/paths'

type VisitOperationalQuickActionsProps = {
  visitId: string
  studyId: string
  subjectId: string
  incompleteProcedures: number
  incompleteSource: number
  firstOpenCaptureHref?: string | null
}

export function VisitOperationalQuickActions({
  visitId,
  studyId,
  subjectId,
  incompleteProcedures,
  incompleteSource,
  firstOpenCaptureHref,
}: VisitOperationalQuickActionsProps) {
  const returnTo = visitDetailPath(visitId)
  const clinicalOpts = { returnTo }

  return (
    <section className="mx-6 mt-6 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">What can I do on this visit now?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {incompleteProcedures > 0
          ? `${incompleteProcedures} procedure(s) still need completion. `
          : 'All procedures marked complete. '}
        {incompleteSource > 0
          ? `${incompleteSource} source item(s) still open.`
          : 'No open source sets flagged.'}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li>
          <Link
            href={visitDetailPath(visitId, 'procedures')}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <ClipboardList className="size-3.5 text-primary" />
            Procedures
          </Link>
        </li>
        <li>
          <Link
            href={visitDetailPath(visitId, 'source')}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <FileText className="size-3.5 text-primary" />
            Source capture
          </Link>
        </li>
        {firstOpenCaptureHref ? (
          <li>
            <Link
              href={firstOpenCaptureHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-accent/30 px-3 py-1.5 text-xs font-medium hover:bg-accent/50"
            >
              Continue where you left off
            </Link>
          </li>
        ) : null}
        <li>
          <Link
            href={visitDetailPath(visitId, 'workflow')}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Signoff & workflow
          </Link>
        </li>
        <li>
          <Link
            href={subjectConMedsTabPath(studyId, subjectId, clinicalOpts)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Pill className="size-3.5 text-primary" />
            ConMeds
          </Link>
        </li>
        <li>
          <Link
            href={subjectClinicalProfilePath(studyId, subjectId)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Stethoscope className="size-3.5 text-primary" />
            Medical history
          </Link>
        </li>
        <li>
          <Link
            href={subjectAdverseEventsTabPath(studyId, subjectId, clinicalOpts)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <AlertTriangle className="size-3.5 text-primary" />
            AE / Safety
          </Link>
        </li>
      </ul>
    </section>
  )
}
