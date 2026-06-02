import { createServerClient } from '@/lib/supabase/server'
import { loadStudyVisits } from '@/lib/visits/loadStudyVisits'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import {
  highestPriorityDispensingAction,
  loadDispensingCommandCenterActions,
} from '@/lib/pharmacy-runtime/dispensing/command-center'
import type { DispensingCommandCenterItem } from '@/lib/pharmacy-runtime/dispensing/types'

export type ActionRequiredType =
  | 'Obtain Initial Consent'
  | 'Obtain Reconsent'
  | 'Upload Consent Document'
  | 'Visit Overdue'
  | 'Schedule Visit'
  | 'Review Dispensation'
  | 'Review Due Today'
  | 'Review Overdue'
  | 'Waiver Requires Approval'
  | 'None'

export type SubjectCommandCenterRow = {
  subjectId: string
  subjectNumber: string
  subjectName: string
  dob: string
  age: string
  phone: string
  email: string
  enrollmentStatus: string
  consentStatus: 'Missing' | 'Active' | 'Expired' | 'Withdrawn'
  reconsentStatus: 'Not Required' | 'Pending' | 'Overdue' | 'Completed' | 'Waived'
  nextVisit: string | null
  nextVisitId: string | null
  lastVisit: string | null
  visitProgress: string
  assignedCoordinator: string
  actionRequired: ActionRequiredType
  dispensingActions: DispensingCommandCenterItem[]
}

export type CommandCenterCounters = {
  activeSubjects: number
  screening: number
  randomized: number
  needConsent: number
  needReconsent: number
  overdueReconsent: number
  pendingUpload: number
  upcomingVisits: number
}

export type StudySubjectCommandCenterModel = {
  rows: SubjectCommandCenterRow[]
  counters: CommandCenterCounters
  error: string | null
}

function calculateAge(dobStr: string | null): string {
  if (!dobStr) return '—'
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return '—'
  const ageDifMs = Date.now() - dob.getTime()
  const ageDate = new Date(ageDifMs)
  return Math.abs(ageDate.getUTCFullYear() - 1970).toString()
}

export async function loadStudySubjectCommandCenter(
  studyId: string,
  organizationId: string
): Promise<StudySubjectCommandCenterModel> {
  const supabase = await createServerClient()
  const empty: StudySubjectCommandCenterModel = {
    rows: [],
    counters: {
      activeSubjects: 0,
      screening: 0,
      randomized: 0,
      needConsent: 0,
      needReconsent: 0,
      overdueReconsent: 0,
      pendingUpload: 0,
      upcomingVisits: 0,
    },
    error: null,
  }

  // Fetch subjects
  const { data: subjects, error: subjErr } = await supabase
    .from('study_subjects')
    // Performance Guard: This loader aggressively avoids N+1 queries by relying on `loadStudyVisits` 
    // and batch fetching `subject_consent_versions`. 
    // However, loading ALL subjects and ALL visits in-memory scales well for up to ~1000 subjects. 
    // For large global registries (5000+ subjects), this should be migrated to a TanStack/Server-side Paginated Model 
    // to prevent edge function memory exhaustion.
    .select(`
      id,
      subject_identifier,
      first_name,
      last_name,
      date_of_birth,
      enrollment_status,
      consented_at
    `)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .order('subject_identifier', { ascending: true })

  if (subjErr) return { ...empty, error: subjErr.message }
  if (!subjects?.length) return empty

  const subjectIds = subjects.map((s) => s.id)

  // Fetch Consent info (active version per subject)
  const { data: activeConsents } = await supabase
    .from('subject_consent_versions')
    .select('study_subject_id, status, active_at, completed_at, consent_type')
    .in('study_subject_id', subjectIds)
    .eq('status', 'active')
    .in('consent_type', ['initial_consent', 're_consent', 'amendment_consent'])

  const { data: withdrawals } = await supabase
    .from('subject_consent_withdrawals')
    .select('study_subject_id, withdrawal_scope')
    .in('study_subject_id', subjectIds)

  const { data: reconsentReqs } = await supabase
    .from('subject_consent_reconsent_requirements')
    .select('study_subject_id, reconsent_status')
    .in('study_subject_id', subjectIds)
    .eq('consent_action_required', true)
    
  // Fetch missing documents / pending upload (proxy using signature artifacts or subject_consent_documents)
  // We'll approximate this by checking if they have an active consent but no document (or pending upload status)
  // For now, let's just see if they have any 'pending' consent requests.
  const { data: pendingEvents } = await supabase
    .from('subject_consent_events')
    .select('study_subject_id, status')
    .in('study_subject_id', subjectIds)
    .eq('status', 'pending_upload')

  const dispensingActionsBySubject = await loadDispensingCommandCenterActions(supabase, studyId, subjectIds)
    
  // Load Visits
  const studyVisits = await loadStudyVisits(studyId, organizationId, 5000)
  const visitsBySubject = new Map<string, typeof studyVisits.rows>()
  
  if (!studyVisits.error && studyVisits.rows) {
    for (const v of studyVisits.rows) {
      if (!visitsBySubject.has(v.studySubjectId)) {
        visitsBySubject.set(v.studySubjectId, [])
      }
      visitsBySubject.get(v.studySubjectId)!.push(v)
    }
  }

  const rows: SubjectCommandCenterRow[] = []
  const counters = { ...empty.counters }
  const today = todayIsoDate()

  for (const s of subjects) {
    const sId = s.id
    
    // Demographics
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—'
    const dob = s.date_of_birth ?? '—'
    const age = calculateAge(s.date_of_birth)
    
    // Consent logic
    const sWithdrawals = withdrawals?.filter(w => w.study_subject_id === sId) ?? []
    const isWithdrawn = sWithdrawals.some(w => w.withdrawal_scope === 'all_study' || w.withdrawal_scope === 'study_treatment')
    const activeConsent = activeConsents?.find(c => c.study_subject_id === sId)
    
    let consentStatus: SubjectCommandCenterRow['consentStatus'] = 'Missing'
    if (isWithdrawn) consentStatus = 'Withdrawn'
    else if (activeConsent) consentStatus = 'Active'
    else if (s.consented_at) consentStatus = 'Active' // Fallback to legacy
    
    // Reconsent logic
    const reqs = reconsentReqs?.filter(r => r.study_subject_id === sId) ?? []
    let reconsentStatus: SubjectCommandCenterRow['reconsentStatus'] = 'Not Required'
    if (reqs.some(r => r.reconsent_status === 'overdue')) reconsentStatus = 'Overdue'
    else if (reqs.some(r => r.reconsent_status === 'pending')) reconsentStatus = 'Pending'
    // ... we don't have waived/completed cleanly mapped right here without more complex queries, but this suffices for the core queue.
    
    // Visits logic
    const sv = visitsBySubject.get(sId) ?? []
    let nextVisit: string | null = null
    let nextVisitId: string | null = null
    let lastVisit: string | null = null
    
    // Rule: Overdue > Next Upcoming > No Visit Action
    const overdue = sv.filter(v => v.group === 'overdue').sort((a,b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))
    const upcoming = sv.filter(v => (v.scheduledDate && v.scheduledDate >= today) || v.group === 'upcoming' || v.group === 'today').sort((a,b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))
    
    if (overdue.length > 0) {
      nextVisit = overdue[0].visitName
      nextVisitId = overdue[0].visitId
    } else if (upcoming.length > 0) {
      nextVisit = upcoming[0].visitName
      nextVisitId = upcoming[0].visitId
    }
    
    const completed = sv.filter(v => v.visitStatus === 'completed' || v.visitStatus === 'locked').sort((a,b) => (b.scheduledDate ?? '').localeCompare(a.scheduledDate ?? ''))
    if (completed.length > 0) lastVisit = completed[0].visitName
    
    const totalVisits = sv.length
    const completedVisits = completed.length
    const visitProgress = totalVisits > 0 ? `${Math.round((completedVisits / totalVisits) * 100)}%` : '—'
    
    // Action logic
    let actionRequired: ActionRequiredType = 'None'
    const hasPendingUpload = pendingEvents?.some(e => e.study_subject_id === sId)
    const hasOverdueVisit = sv.some(v => v.group === 'overdue')
    const dispensingActions = dispensingActionsBySubject.get(sId) ?? []
    const dispensingAction = highestPriorityDispensingAction(dispensingActions)
    
    if (dispensingAction) {
      actionRequired = dispensingAction.actionRequired
    } else if (consentStatus === 'Missing' && s.enrollment_status !== 'screen_failed') {
      actionRequired = 'Obtain Initial Consent'
    } else if (reconsentStatus === 'Overdue') {
      actionRequired = 'Obtain Reconsent'
    } else if (reconsentStatus === 'Pending') {
      actionRequired = 'Obtain Reconsent'
    } else if (hasPendingUpload) {
      actionRequired = 'Upload Consent Document'
    } else if (hasOverdueVisit) {
      actionRequired = 'Visit Overdue'
    } else if (consentStatus === 'Active' && totalVisits === 0) {
      actionRequired = 'Schedule Visit'
    }
    
    // Update counters
    if (s.enrollment_status === 'screening' || s.enrollment_status === 'enrolled' || s.enrollment_status === 'randomized') {
      counters.activeSubjects++
    }
    if (s.enrollment_status === 'screening') counters.screening++
    if (s.enrollment_status === 'randomized') counters.randomized++
    if (consentStatus === 'Missing') counters.needConsent++
    if (reconsentStatus === 'Pending' || reconsentStatus === 'Overdue') counters.needReconsent++
    if (reconsentStatus === 'Overdue') counters.overdueReconsent++
    if (hasPendingUpload) counters.pendingUpload++
    
    rows.push({
      subjectId: sId,
      subjectNumber: s.subject_identifier,
      subjectName: name,
      dob,
      age,
      phone: '—',
      email: '—',
      enrollmentStatus: s.enrollment_status,
      consentStatus,
      reconsentStatus,
      nextVisit,
      nextVisitId,
      lastVisit,
      visitProgress,
      assignedCoordinator: 'Unassigned',
      actionRequired,
      dispensingActions,
    })
  }
  
  // Aggregate upcoming visits counter
  counters.upcomingVisits = studyVisits.today.length + studyVisits.upcoming.length

  return { rows, counters, error: null }
}
