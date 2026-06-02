import { createServerClient } from '@/lib/supabase/server'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'

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

  // 1. Action Required
  const { count: pendingSignatures } = await supabase
    .from('compliance_obligations')
    .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('compliance_runtime_documents.study_id', studyId)
    .in('status', ['pending', 'overdue', 'escalated'])

  const { count: regulatoryExpirations } = await supabase
    .from('compliance_expiration_alerts')
    .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('compliance_runtime_documents.study_id', studyId)
    .in('status', ['pending', 'escalated'])

  // 2. Visits & Subjects
  const { data: subjects } = await supabase
    .from('study_subjects')
    .select(`
      id,
      subject_adverse_events ( id, lifecycle_status ),
      visits (
        id,
        scheduled_date,
        target_date,
        window_start,
        window_end,
        actual_date,
        visit_status,
        updated_at
      )
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  let next7Days = 0
  let next14Days = 0
  let overdueVisits = 0
  let subjectsWithActiveAEs = 0
  let subjectsWithOverdueVisits = 0

  const recentEvents: any[] = []

  if (subjects) {
    const todayTime = new Date(refDate).getTime()
    const dayMs = 1000 * 60 * 60 * 24

    for (const sub of subjects) {
      const aes = sub.subject_adverse_events || []
      const hasAe = aes.some((ae: any) => ae.lifecycle_status === 'open')
      if (hasAe) subjectsWithActiveAEs++

      let subHasOverdue = false

      const visits = sub.visits || []
      for (const v of visits) {
        const refreshed = refreshVisitOperationalFields({
          visitStatus: v.visit_status,
          scheduledDate: v.scheduled_date,
          targetDate: v.target_date,
          windowStartDate: v.window_start,
          windowEndDate: v.window_end,
          actualDate: v.actual_date,
          completedAt: null,
          referenceDate: refDate
        })

        if (refreshed.visitStatus === 'completed') {
          recentEvents.push({
            id: v.id,
            type: 'visit_completed',
            description: 'Visit completed',
            date: v.updated_at
          })
        }

        if (refreshed.windowStatus === 'outside_window' || refreshed.visitStatus === 'missed') {
          overdueVisits++
          subHasOverdue = true
        } else if (['scheduled', 'expected', 'pending'].includes(refreshed.visitStatus)) {
          const activeDate = v.scheduled_date || v.target_date
          if (activeDate) {
            const timeDiff = new Date(activeDate).getTime() - todayTime
            const daysDiff = Math.ceil(timeDiff / dayMs)
            
            if (daysDiff >= 0 && daysDiff <= 7) {
              next7Days++
              next14Days++
            } else if (daysDiff > 7 && daysDiff <= 14) {
              next14Days++
            }
          }
        }
      }

      if (subHasOverdue) subjectsWithOverdueVisits++
    }
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
      pendingSignatures: pendingSignatures || 0,
      regulatoryExpirations: regulatoryExpirations || 0
    },
    visitHorizon: {
      next7Days,
      next14Days,
      overdue: overdueVisits
    },
    subjectAttention: {
      withActiveAEs: subjectsWithActiveAEs,
      withOverdueVisits: subjectsWithOverdueVisits,
      requiringReview: pendingSignatures || 0
    },
    recentActivity: recentEvents.slice(0, 5)
  }
}
