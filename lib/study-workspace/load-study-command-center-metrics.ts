import { createServerClient } from '@/lib/supabase/server'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'

export type StudyCommandCenterMetrics = {
  actionRequired: {
    pendingSignatures: number
    regulatoryExpirations: number
  }
  visitHorizon: {
    next7Days: number
    next14Days: number
    overdue: number
  }
  subjectAttention: {
    withActiveAEs: number
    withOverdueVisits: number
    requiringReview: number
  }
  recentActivity: {
    id: string
    type: 'visit_completed' | 'document_uploaded' | 'signature_completed'
    description: string
    date: string
  }[]
}

export async function loadStudyCommandCenterMetrics(
  studyId: string,
  organizationId: string
): Promise<StudyCommandCenterMetrics> {
  const supabase = await createServerClient()
  const refDate = todayIsoDate()
  const next7Date = addDaysIso(refDate, 7)
  const next14Date = addDaysIso(refDate, 14)

  const [
    pendingSignatures,
    regulatoryExpirations,
    next7Days,
    next14Days,
    overdueVisits,
    activeAeRecords,
  ] = await Promise.all([
    countComplianceObligations(studyId, organizationId),
    countRegulatoryExpirations(studyId, organizationId),
    countVisitsBetween(studyId, organizationId, refDate, next7Date),
    countVisitsBetween(studyId, organizationId, refDate, next14Date),
    countOverdueVisits(studyId, organizationId),
    countActiveAeRecords(studyId, organizationId),
  ])

  const recentEvents: StudyCommandCenterMetrics['recentActivity'] = []

  const { data: recentVisits } = await supabase
    .from('visits')
    .select('id, updated_at')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('visit_status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(5)

  for (const visit of recentVisits ?? []) {
    if (!visit.updated_at) continue
    recentEvents.push({
      id: String(visit.id),
      type: 'visit_completed',
      description: 'Visit completed',
      date: String(visit.updated_at),
    })
  }

  // Fetch recent documents
  const { data: recentDocs } = await supabase
    .from('compliance_runtime_documents')
    .select('id, name, created_at')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (recentDocs) {
    for (const doc of recentDocs) {
      recentEvents.push({
        id: doc.id,
        type: 'document_uploaded',
        description: `Document uploaded: ${doc.name}`,
        date: doc.created_at
      })
    }
  }

  // Fetch recent signatures
  const { data: recentSigs } = await supabase
    .from('compliance_obligations')
    .select('id, completed_at, compliance_runtime_documents!inner(study_id)')
    .eq('organization_id', organizationId)
    .eq('compliance_runtime_documents.study_id', studyId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5)

  if (recentSigs) {
    for (const sig of recentSigs) {
      if (sig.completed_at) {
        recentEvents.push({
          id: sig.id,
          type: 'signature_completed',
          description: 'Signature obligation completed',
          date: sig.completed_at
        })
      }
    }
  }

  recentEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    actionRequired: {
      pendingSignatures,
      regulatoryExpirations
    },
    visitHorizon: {
      next7Days,
      next14Days,
      overdue: overdueVisits
    },
    subjectAttention: {
      withActiveAEs: activeAeRecords,
      withOverdueVisits: overdueVisits,
      requiringReview: pendingSignatures
    },
    recentActivity: recentEvents.slice(0, 5)
  }
}

function addDaysIso(date: string, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

async function countComplianceObligations(studyId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('compliance_obligations')
    .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('compliance_runtime_documents.study_id', studyId)
    .in('status', ['pending', 'overdue', 'escalated'])

  return count ?? 0
}

async function countRegulatoryExpirations(studyId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('compliance_expiration_alerts')
    .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('compliance_runtime_documents.study_id', studyId)
    .in('status', ['pending', 'escalated'])

  return count ?? 0
}

async function countVisitsBetween(
  studyId: string,
  organizationId: string,
  startDate: string,
  endDate: string,
) {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .not('scheduled_date', 'is', null)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .in('visit_status', ['scheduled', 'checked_in', 'in_progress'])

  return count ?? 0
}

async function countOverdueVisits(studyId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .or('visit_status.in.(missed,out_of_window),window_status.eq.outside_window')

  return count ?? 0
}

async function countActiveAeRecords(studyId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('subject_adverse_events')
    .select('ae_id, study_subjects!inner(study_id)', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_subjects.study_id', studyId)
    .eq('lifecycle_status', 'open')

  return count ?? 0
}
