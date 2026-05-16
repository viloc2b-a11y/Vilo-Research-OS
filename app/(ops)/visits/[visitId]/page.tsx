import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ProcedureCompleteButton } from '@/components/clinical/procedure-complete-button'
import { VisitLifecycleActions } from '@/components/clinical/visit-lifecycle-actions'
import { createServerClient } from '@/lib/supabase/server'

type VisitDetailPageProps = {
  params: Promise<{ visitId: string }>
}

export default async function VisitDetailPage({ params }: VisitDetailPageProps) {
  const { visitId } = await params
  const supabase = await createServerClient()

  const { data: visit, error: vErr } = await supabase
    .from('visits')
    .select(
      `
      id,
      scheduled_date,
      visit_status,
      study_id,
      study_subject_id,
      visit_definitions(code,label),
      study_subjects(subject_identifier)
    `,
    )
    .eq('id', visitId)
    .maybeSingle()

  if (vErr || !visit) {
    notFound()
  }

  const { data: studyBanner } = await supabase
    .from('studies')
    .select('name')
    .eq('id', visit.study_id)
    .maybeSingle()

  const vdRaw = Array.isArray(visit.visit_definitions)
    ? visit.visit_definitions[0]
    : visit.visit_definitions
  const vd = vdRaw as { code?: string; label?: string } | null

  const subjectEmbed = Array.isArray(visit.study_subjects)
    ? visit.study_subjects[0]
    : visit.study_subjects
  const subjectPick = subjectEmbed as { subject_identifier?: string | null } | null
  const subjectLabel = subjectPick?.subject_identifier ?? 'Subject'

  const subjectPath = `/subjects/${visit.study_subject_id}`
  const studyPath = `/studies/${visit.study_id}`
  const visitPath = `/visits/${visit.id}`
  const studyNavName = studyBanner?.name ?? 'Study'

  const visitAllowsProcedureEdits =
    visit.visit_status === 'scheduled'
    || visit.visit_status === 'checked_in'
    || visit.visit_status === 'in_progress'

  const { data: procedures, error: pErr } = await supabase
    .from('procedure_executions')
    .select(
      `
      id,
      execution_status,
      performed_at,
      procedure_definitions(code,label)
    `,
    )
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/studies" className="hover:underline">
            Studies
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <Link href={studyPath} className="hover:underline">
            {studyNavName}
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <Link href={subjectPath} className="hover:underline">
            {subjectLabel}
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <span className="text-foreground">
            Visit · {visit.scheduled_date ?? visit.id.slice(0, 8)}
          </span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {vd?.label ?? vd?.code ?? 'Visit'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Status{' '}
          <span className="font-medium text-foreground">{visit.visit_status}</span>
          {' · Scheduled '}
          <span className="font-medium text-foreground">{visit.scheduled_date ?? '—'}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Complete the visit after required procedures are done. Locking freezes the record and moves completed
            procedures to verified.
          </p>
          <VisitLifecycleActions
            visitId={visit.id}
            visitPath={visitPath}
            studyPath={studyPath}
            subjectPath={subjectPath}
            visitStatus={visit.visit_status}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procedure executions</CardTitle>
          <CardDescription>
            Mark pending work complete — writes execution row and emits an operational fact
            (<code className="text-xs">PROCEDURE_COMPLETED</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pErr ? (
            <p className="text-sm text-destructive">{pErr.message}</p>
          ) : !procedures?.length ? (
            <p className="text-sm text-muted-foreground">No procedures on this visit.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {procedures.map((proc) => {
                const pdf = proc.procedure_definitions
                const pdefRaw = Array.isArray(pdf) ? pdf[0] : pdf
                const pdef = pdefRaw as { code?: string; label?: string } | null
                const canComplete =
                  visitAllowsProcedureEdits
                  && (proc.execution_status === 'pending' || proc.execution_status === 'in_progress')
                return (
                  <li
                    key={proc.id}
                    className="flex flex-col gap-2 px-3 py-3 text-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{pdef?.label ?? pdef?.code ?? 'Procedure'}</p>
                      <p className="text-muted-foreground">
                        Status{' '}
                        <span className="text-foreground">{proc.execution_status}</span>
                        {proc.performed_at ? (
                          <>
                            {' '}
                            · Performed{' '}
                            <span className="text-foreground">{proc.performed_at}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <ProcedureCompleteButton
                      procedureExecutionId={proc.id}
                      visitPath={visitPath}
                      studyPath={studyPath}
                      subjectPath={subjectPath}
                      disabled={!canComplete}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
