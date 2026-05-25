import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { SubjectVisitScheduleGenerateButton } from '@/components/coordinator-operations/SubjectVisitScheduleGenerateButton'
import { createServerClient } from '@/lib/supabase/server'
import { subjectVisitsPath } from '@/lib/ops/paths'

type SubjectVisitScheduleActionProps = {
  studyId: string
  subjectId: string
  organizationId: string
  enrollmentStatus: string | null
}

export async function SubjectVisitScheduleAction({
  studyId,
  subjectId,
  organizationId,
  enrollmentStatus,
}: SubjectVisitScheduleActionProps) {
  const supabase = await createServerClient()
  const visitsHref = subjectVisitsPath(studyId, subjectId)

  const [{ count: visitCount }, { count: definitionCount }, subjectRow] = await Promise.all([
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('study_subject_id', subjectId)
      .eq('organization_id', organizationId),
    supabase
      .from('visit_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId),
    supabase
      .from('study_subjects')
      .select('visit_schedule_generated_at, schedule_anchor_date, updated_at')
      .eq('id', subjectId)
      .maybeSingle(),
  ])

  const totalVisits = visitCount ?? 0
  const protocolVisits = definitionCount ?? 0
  const scheduleGenerated = Boolean(subjectRow.data?.visit_schedule_generated_at)
  const enroll = enrollmentStatus ?? 'unknown'
  const canGenerateStatus = ['enrolled', 'randomized', 'completed'].includes(enroll)

  if (totalVisits > 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Schedule / create visit</p>
          <p className="text-xs text-muted-foreground">
            {totalVisits} visit(s) on record. Open the schedule to assign dates or start execution.
          </p>
        </div>
        <Link
          href={visitsHref}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CalendarPlus className="size-3.5" />
          View scheduled visits
        </Link>
      </div>
    )
  }

  if (protocolVisits === 0) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Schedule / create visit</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Visit creation is not enabled for this study yet — no protocol visit definitions are
          provisioned. Contact your study setup lead to add the visit schedule.
        </p>
      </div>
    )
  }

  if (!canGenerateStatus) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Schedule / create visit</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Visits are generated from the protocol schedule after enrollment or randomization (current
          status: {enroll.replace(/_/g, ' ')}). Update enrollment on the subject chart when the
          participant is ready.
        </p>
        <Link href={`/studies/${studyId}/subjects/${subjectId}?tab=general`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
          Open subject chart → General
        </Link>
      </div>
    )
  }

  if (!scheduleGenerated) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Schedule / create visit</p>
        <p className="text-xs text-muted-foreground">
          Protocol defines {protocolVisits} visit(s). Generate the subject visit schedule from
          templates — no visits are on record yet.
        </p>
        <SubjectVisitScheduleGenerateButton
          studySubjectId={subjectId}
          organizationId={organizationId}
          expectedUpdatedAt={subjectRow.data?.updated_at as string | undefined}
        />
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">Schedule / create visit</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Schedule was generated but no visits are visible yet. Refresh the visits page or check study
        provisioning.
      </p>
      <Link href={visitsHref} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        Open visit schedule
      </Link>
    </div>
  )
}
