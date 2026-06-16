import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecruitmentLeadSummary = {
  id: string
  full_name: string
  phone: string
  email: string | null
  stage: string
  prescreen_score: number | null
  recruitment_source_channel: string | null
  campaign_id: string | null
  assigned_user_id: string | null
  contact_attempts: number
  last_contacted_at: string | null
  next_follow_up_at: string | null
  created_at: string
  priority_score: number
}

export type StudyPressureCard = {
  study_id: string
  study_name: string
  target_leads: number | null
  randomized_count: number
  qualified_count: number
  scheduled_count: number
  days_since_last_qualified: number | null
  pressure_signal: 'on_track' | 'lagging' | 'stalled'
}

export type RecruitmentCommandCenterData = {
  todaysWork: RecruitmentLeadSummary[]
  queue: { leads: RecruitmentLeadSummary[]; total: number }
  studyPressure: StudyPressureCard[]
}

// ---------------------------------------------------------------------------
// Priority score computation (exported for direct unit testing)
// ---------------------------------------------------------------------------

export function computePriorityScore(lead: {
  next_follow_up_at: string | null
  prescreen_score: number | null
  created_at: string
  contact_attempts: number
}): number {
  const now = new Date()
  const todayDate = now.toISOString().split('T')[0]
  let score = 0

  if (lead.next_follow_up_at) {
    const followUpDate = new Date(lead.next_follow_up_at)
    if (followUpDate < now) {
      score += 100 // overdue
    } else if (lead.next_follow_up_at.startsWith(todayDate)) {
      score += 80 // due today
    }
  }

  if (lead.prescreen_score !== null) {
    if (lead.prescreen_score >= 16) {
      score += 60 // high score
    } else if (lead.prescreen_score >= 10) {
      score += 40 // medium score
    }
  }

  const createdAt = new Date(lead.created_at)
  if (now.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000) {
    score += 30 // new lead < 24h
  }

  if (lead.contact_attempts === 0) {
    score += 20 // no contact yet
  }

  return score
}

// ---------------------------------------------------------------------------
// Scope filter (exported for direct unit testing)
// ---------------------------------------------------------------------------

export function filterLeadScope(
  leads: RecruitmentLeadSummary[],
  userId: string,
  scope: 'default' | 'all',
): RecruitmentLeadSummary[] {
  if (scope === 'all') return leads
  // default: assigned to me or unassigned
  return leads.filter(
    (l) => l.assigned_user_id === userId || l.assigned_user_id === null,
  )
}

// ---------------------------------------------------------------------------
// Raw row → RecruitmentLeadSummary
// ---------------------------------------------------------------------------

function rowToLeadSummary(row: Record<string, unknown>): RecruitmentLeadSummary {
  const base = {
    id: String(row.id),
    full_name: String(row.full_name),
    phone: String(row.phone ?? ''),
    email: row.email ? String(row.email) : null,
    stage: String(row.stage ?? 'lead'),
    prescreen_score: row.prescreen_score != null ? Number(row.prescreen_score) : null,
    recruitment_source_channel: row.recruitment_source_channel
      ? String(row.recruitment_source_channel)
      : null,
    campaign_id: row.campaign_id ? String(row.campaign_id) : null,
    assigned_user_id: row.assigned_user_id ? String(row.assigned_user_id) : null,
    contact_attempts: Number(row.contact_attempts ?? 0),
    last_contacted_at: row.last_contacted_at ? String(row.last_contacted_at) : null,
    next_follow_up_at: row.next_follow_up_at ? String(row.next_follow_up_at) : null,
    created_at: String(row.created_at),
    priority_score: 0,
  }
  return { ...base, priority_score: computePriorityScore(base) }
}

// ---------------------------------------------------------------------------
// loadTodaysRecruitmentWork
// ---------------------------------------------------------------------------

export async function loadTodaysRecruitmentWork(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<RecruitmentLeadSummary[]> {
  const { data, error } = await supabase
    .from('patient_leads')
    .select(
      'id, full_name, phone, email, stage, prescreen_score, recruitment_source_channel, campaign_id, assigned_user_id, contact_attempts, last_contacted_at, next_follow_up_at, created_at',
    )
    .eq('organization_id', orgId)
    .not('stage', 'in', '("closed","randomized")')
    .is('archived_at', null)
    .or(`assigned_user_id.eq.${userId},assigned_user_id.is.null`)
    .order('created_at', { ascending: true })
    .limit(100) // over-fetch; sort by priority_score in TS and slice top 20

  if (error || !data) return []

  const leads = (data as Record<string, unknown>[]).map(rowToLeadSummary)
  leads.sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return leads.slice(0, 20)
}

// ---------------------------------------------------------------------------
// loadRecruitmentQueue
// ---------------------------------------------------------------------------

export async function loadRecruitmentQueue(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  role: string,
  filters: {
    scope?: 'default' | 'all'
    page?: number
    stage?: string
    showClosed?: boolean
  },
): Promise<{ leads: RecruitmentLeadSummary[]; total: number }> {
  const page = filters.page ?? 0
  const pageSize = 25
  const offset = page * pageSize

  // Only owners/admins may use scope='all'; fallback to default for everyone else
  const canViewAll = ['owner', 'admin'].includes(role)
  const scope = canViewAll && filters.scope === 'all' ? 'all' : 'default'

  let query = supabase
    .from('patient_leads')
    .select(
      'id, full_name, phone, email, stage, prescreen_score, recruitment_source_channel, campaign_id, assigned_user_id, contact_attempts, last_contacted_at, next_follow_up_at, created_at',
      { count: 'exact' },
    )
    .eq('organization_id', orgId)
    .is('archived_at', null)

  if (!filters.showClosed) {
    query = query.not('stage', 'in', '("closed")')
  }

  if (scope !== 'all') {
    query = query.or(`assigned_user_id.eq.${userId},assigned_user_id.is.null`)
  }

  if (filters.stage) {
    query = query.eq('stage', filters.stage)
  }

  const { data, count, error } = await (query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1) as unknown as Promise<{
    data: Record<string, unknown>[] | null
    count: number | null
    error: unknown
  }>)

  if (error || !data) return { leads: [], total: 0 }

  const leads = data.map(rowToLeadSummary)
  leads.sort((a, b) => b.priority_score - a.priority_score)

  return { leads, total: count ?? 0 }
}

// ---------------------------------------------------------------------------
// loadStudyPressureCards
// ---------------------------------------------------------------------------

export async function loadStudyPressureCards(
  supabase: SupabaseClient,
  orgId: string,
): Promise<StudyPressureCard[]> {
  // Step 1: load active studies
  const { data: studies, error: studiesError } = await supabase
    .from('studies')
    .select('id, name, target_enrollment, status')
    .eq('organization_id', orgId)
    .in('status', ['recruiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (studiesError || !studies || studies.length === 0) return []

  const studyRows = studies as Record<string, unknown>[]
  const studyIds = studyRows.map((s) => String(s.id))

  // Step 2: load leads for those studies via patient_leads.study_id
  // (patient_leads has a direct study_id column for the primary study assignment)
  const { data: leadRows } = await supabase
    .from('patient_leads')
    .select('id, stage, study_id, created_at')
    .eq('organization_id', orgId)
    .in('study_id', studyIds)
    .is('archived_at', null)
    .limit(2000)

  const allLeads = (leadRows as Record<string, unknown>[] | null) ?? []

  // Group leads by study_id
  const leadsByStudy = new Map<string, Record<string, unknown>[]>()
  for (const lead of allLeads) {
    const sid = String(lead.study_id)
    if (!leadsByStudy.has(sid)) leadsByStudy.set(sid, [])
    leadsByStudy.get(sid)!.push(lead)
  }

  const now = Date.now()

  return studyRows.map((study) => {
    const sid = String(study.id)
    const target = study.target_enrollment != null ? Number(study.target_enrollment) : null
    const leads = leadsByStudy.get(sid) ?? []

    let randomized_count = 0
    let qualified_count = 0
    let scheduled_count = 0
    let lastQualifiedMs: number | null = null

    for (const lead of leads) {
      const stage = String(lead.stage ?? '')
      if (stage === 'randomized') randomized_count++
      if (stage === 'qualified') {
        qualified_count++
        const ms = new Date(String(lead.created_at)).getTime()
        if (lastQualifiedMs === null || ms > lastQualifiedMs) lastQualifiedMs = ms
      }
      if (stage === 'scheduled') scheduled_count++
    }

    const days_since_last_qualified =
      lastQualifiedMs !== null
        ? Math.floor((now - lastQualifiedMs) / (1000 * 60 * 60 * 24))
        : null

    let pressure_signal: 'on_track' | 'lagging' | 'stalled' = 'stalled'
    if (target != null && target > 0) {
      const ratio = qualified_count / target
      if (ratio >= 0.5 && (days_since_last_qualified === null || days_since_last_qualified <= 14)) {
        pressure_signal = 'on_track'
      } else if (ratio >= 0.2) {
        pressure_signal = 'lagging'
      }
    }

    return {
      study_id: sid,
      study_name: String(study.name ?? ''),
      target_leads: target,
      randomized_count,
      qualified_count,
      scheduled_count,
      days_since_last_qualified,
      pressure_signal,
    }
  })
}

// ---------------------------------------------------------------------------
// loadRecruitmentCommandCenter (aggregator)
// ---------------------------------------------------------------------------

export async function loadRecruitmentCommandCenter(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  role: string,
): Promise<RecruitmentCommandCenterData> {
  const [todaysWork, queue, studyPressure] = await Promise.all([
    loadTodaysRecruitmentWork(supabase, orgId, userId),
    loadRecruitmentQueue(supabase, orgId, userId, role, {}),
    loadStudyPressureCards(supabase, orgId),
  ])

  return { todaysWork, queue, studyPressure }
}
