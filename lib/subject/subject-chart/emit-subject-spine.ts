import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export async function emitSubjectChartSpineEvent(input: {
  supabase: Supabase
  organizationId: string
  studyId: string
  subjectId: string
  actorUserId: string
  eventType: string
  mutation: string
  details?: Record<string, unknown>
}): Promise<void> {
  await ClinicalMutationGateway.emitStudy({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    payloadSource: 'subject-chart-actions',
    mutation: input.mutation,
    subjectId: input.subjectId,
    details: input.details,
  })
}

export async function emitSubjectEnrollmentRollback(input: {
  supabase: Supabase
  organizationId: string
  studyId: string
  subjectId: string
  actorUserId: string
  eventType: string
  mutation: string
  details?: Record<string, unknown>
}): Promise<void> {
  await emitSubjectChartSpineEvent({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    subjectId: input.subjectId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    mutation: input.mutation,
    details: {
      compensating_rollback: true,
      ...input.details,
    },
  })
}
