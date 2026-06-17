import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Stage enum — canonical order defines funnel progression
// ---------------------------------------------------------------------------

export type CrmPatientStageEnum =
  | 'lead'
  | 'contacted'
  | 'pre_screen'
  | 'qualified'
  | 'scheduled'
  | 'consented'
  | 'screened'
  | 'randomized'

const STAGE_ORDER: CrmPatientStageEnum[] = [
  'lead',
  'contacted',
  'pre_screen',
  'qualified',
  'scheduled',
  'consented',
  'screened',
  'randomized',
]

// ---------------------------------------------------------------------------
// RecruitmentFunnelSummary
// ---------------------------------------------------------------------------

export type RecruitmentFunnelSummary = {
  stages: {
    stage: CrmPatientStageEnum
    count: number
    percent_of_entry: number
    drop_off_from_previous: number
  }[]
  total_leads: number
  terminal_converted: number
  overall_conversion_rate: number
  as_of: string
}

export async function loadRecruitmentFunnelSummary(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { studyId?: string; periodDays?: number },
): Promise<RecruitmentFunnelSummary> {
  const as_of = new Date().toISOString()

  // Build query — cast through unknown to avoid Supabase builder type narrowing issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('patient_leads')
    .select('stage')
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  if (options?.studyId) {
    const matchSubquery = supabase
      .from('patient_study_matches')
      .select('patient_lead_id')
      .eq('study_id', options.studyId)
    query = query.in('id', matchSubquery)
  }

  if (options?.periodDays) {
    const since = new Date(Date.now() - options.periodDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data, error } = await query as { data: { stage: string }[] | null; error: unknown }

  if (error || !data) {
    return emptyFunnelSummary(as_of)
  }

  const rows = data as { stage: string }[]

  // Count per stage
  const counts = new Map<string, number>()
  for (const row of rows) {
    const s = row.stage ?? 'lead'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }

  const leadCount = counts.get('lead') ?? 0
  const total_leads = rows.length
  const terminal_converted = counts.get('randomized') ?? 0
  const overall_conversion_rate = total_leads > 0 ? terminal_converted / total_leads : 0

  const stages = STAGE_ORDER.map((stage, index) => {
    const count = counts.get(stage) ?? 0
    const prevCount = index > 0 ? (counts.get(STAGE_ORDER[index - 1]) ?? 0) : 0
    return {
      stage,
      count,
      percent_of_entry: leadCount > 0 ? count / leadCount : 0,
      drop_off_from_previous: index === 0 ? 0 : prevCount - count,
    }
  })

  return {
    stages,
    total_leads,
    terminal_converted,
    overall_conversion_rate,
    as_of,
  }
}

function emptyFunnelSummary(as_of: string): RecruitmentFunnelSummary {
  return {
    stages: STAGE_ORDER.map((stage) => ({
      stage,
      count: 0,
      percent_of_entry: 0,
      drop_off_from_previous: 0,
    })),
    total_leads: 0,
    terminal_converted: 0,
    overall_conversion_rate: 0,
    as_of,
  }
}

// ---------------------------------------------------------------------------
// SourceEffectivenessReport
// ---------------------------------------------------------------------------

export type SourceEffectivenessReport = {
  sources: {
    source_channel: string
    total_leads: number
    qualified: number
    screened: number
    randomized: number
    disqualified: number
    lead_to_randomize_rate: number
    campaigns: {
      campaign_id: string
      total_leads: number
      randomized: number
      conversion_rate: number
    }[]
  }[]
  top_source: string | null
  top_converting_source: string | null
  unattributed_count: number
  as_of: string
}

export async function loadSourceEffectiveness(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { studyId?: string; periodDays?: number },
): Promise<SourceEffectivenessReport> {
  const as_of = new Date().toISOString()

  // Build query — cast through any to avoid Supabase builder type narrowing issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('patient_leads')
    .select('stage, recruitment_source_channel, campaign_id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  if (options?.studyId) {
    const matchSubquery = supabase
      .from('patient_study_matches')
      .select('patient_lead_id')
      .eq('study_id', options.studyId)
    query = query.in('id', matchSubquery)
  }

  if (options?.periodDays) {
    const since = new Date(Date.now() - options.periodDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data, error } = await query as {
    data: { stage: string; recruitment_source_channel: string | null; campaign_id: string | null }[] | null
    error: unknown
  }

  if (error || !data) {
    return emptySourceReport(as_of)
  }

  const rows = data as { stage: string; recruitment_source_channel: string | null; campaign_id: string | null }[]

  // Group by source
  type SourceAgg = {
    total_leads: number
    qualified: number
    screened: number
    randomized: number
    disqualified: number
    campaigns: Map<string, { total_leads: number; randomized: number }>
  }

  const sourceMap = new Map<string, SourceAgg>()
  let unattributed_count = 0

  for (const row of rows) {
    const source = row.recruitment_source_channel
    if (source === null) {
      unattributed_count++
      continue
    }

    if (!sourceMap.has(source)) {
      sourceMap.set(source, {
        total_leads: 0,
        qualified: 0,
        screened: 0,
        randomized: 0,
        disqualified: 0,
        campaigns: new Map(),
      })
    }

    const agg = sourceMap.get(source)!
    agg.total_leads++

    const stage = row.stage ?? ''
    if (stage === 'qualified') agg.qualified++
    if (stage === 'screened') agg.screened++
    if (stage === 'randomized') agg.randomized++
    // disqualified: treat 'closed' as disqualified
    if (stage === 'closed') agg.disqualified++

    // Campaign aggregation
    const campaignId = row.campaign_id
    if (campaignId) {
      if (!agg.campaigns.has(campaignId)) {
        agg.campaigns.set(campaignId, { total_leads: 0, randomized: 0 })
      }
      const ca = agg.campaigns.get(campaignId)!
      ca.total_leads++
      if (stage === 'randomized') ca.randomized++
    }
  }

  const sources = Array.from(sourceMap.entries()).map(([source_channel, agg]) => {
    const lead_to_randomize_rate = agg.total_leads > 0 ? agg.randomized / agg.total_leads : 0
    const campaigns = Array.from(agg.campaigns.entries()).map(([campaign_id, ca]) => ({
      campaign_id,
      total_leads: ca.total_leads,
      randomized: ca.randomized,
      conversion_rate: ca.total_leads > 0 ? ca.randomized / ca.total_leads : 0,
    }))

    return {
      source_channel,
      total_leads: agg.total_leads,
      qualified: agg.qualified,
      screened: agg.screened,
      randomized: agg.randomized,
      disqualified: agg.disqualified,
      lead_to_randomize_rate,
      campaigns,
    }
  })

  // top_source: highest total_leads
  let top_source: string | null = null
  let maxLeads = 0
  for (const s of sources) {
    if (s.total_leads > maxLeads) {
      maxLeads = s.total_leads
      top_source = s.source_channel
    }
  }

  // top_converting_source: highest lead_to_randomize_rate with >= 5 leads
  let top_converting_source: string | null = null
  let maxRate = -1
  for (const s of sources) {
    if (s.total_leads >= 5 && s.lead_to_randomize_rate > maxRate) {
      maxRate = s.lead_to_randomize_rate
      top_converting_source = s.source_channel
    }
  }

  return {
    sources,
    top_source,
    top_converting_source,
    unattributed_count,
    as_of,
  }
}

function emptySourceReport(as_of: string): SourceEffectivenessReport {
  return {
    sources: [],
    top_source: null,
    top_converting_source: null,
    unattributed_count: 0,
    as_of,
  }
}
