import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignType =
  | 'referral_partner'
  | 'digital_paid'
  | 'community_event'
  | 'organic_seo'
  | 'internal'

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'closed'

export type CampaignListItem = {
  id: string
  name: string
  status: CampaignStatus
  campaign_type: CampaignType
  utm_campaign: string | null
  target_leads: number | null
  target_enrollments: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  linked_study_count: number
  leads_generated: number
  qualified_leads: number
  randomized_subjects: number
}

export type CampaignDetail = CampaignListItem & {
  description: string | null
  linked_studies: {
    study_id: string
    study_name: string
    target_leads: number | null
    target_enrollments: number | null
  }[]
  top_sources: { utm_source: string | null; count: number }[]
  top_mediums: { utm_medium: string | null; count: number }[]
  screened_count: number
}

// ---------------------------------------------------------------------------
// Qualified-stage set
// ---------------------------------------------------------------------------

// Stages that count toward "qualified" metric (qualified + downstream)
const QUALIFIED_STAGES = new Set([
  'qualified',
  'scheduled',
  'consented',
  'screened',
  'randomized',
])

// ---------------------------------------------------------------------------
// loadCampaignList
// ---------------------------------------------------------------------------

export async function loadCampaignList(
  supabase: SupabaseClient,
  organizationId: string,
  status?: CampaignStatus | 'all',
): Promise<CampaignListItem[]> {
  // Query 1: fetch campaigns
  let campaignQuery = supabase
    .from('recruitment_campaigns')
    .select('id, name, status, campaign_type, utm_campaign, target_leads, target_enrollments, start_date, end_date, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    campaignQuery = campaignQuery.eq('status', status)
  }

  const { data: campaigns, error: campaignError } = await campaignQuery

  if (campaignError || !campaigns || campaigns.length === 0) {
    return []
  }

  const campaignIds = campaigns.map((c) => c.id as string)

  // Query 2: lead counts per campaign (all stages)
  const { data: leadRows } = await supabase
    .from('patient_leads')
    .select('campaign_id, stage')
    .in('campaign_id', campaignIds)
    .is('archived_at', null) as { data: { campaign_id: string; stage: string }[] | null }

  // Query 3: linked study counts per campaign
  const { data: studyRows } = await supabase
    .from('campaign_studies')
    .select('campaign_id')
    .in('campaign_id', campaignIds) as { data: { campaign_id: string }[] | null }

  // Aggregate lead counts in memory
  type LeadAgg = { total: number; qualified: number; randomized: number }
  const leadAgg = new Map<string, LeadAgg>()

  for (const row of leadRows ?? []) {
    const cid = row.campaign_id
    if (!leadAgg.has(cid)) {
      leadAgg.set(cid, { total: 0, qualified: 0, randomized: 0 })
    }
    const agg = leadAgg.get(cid)!
    agg.total++
    if (QUALIFIED_STAGES.has(row.stage)) agg.qualified++
    if (row.stage === 'randomized') agg.randomized++
  }

  // Aggregate study counts in memory
  const studyCountMap = new Map<string, number>()
  for (const row of studyRows ?? []) {
    studyCountMap.set(row.campaign_id, (studyCountMap.get(row.campaign_id) ?? 0) + 1)
  }

  // Merge
  return campaigns.map((c) => {
    const agg = leadAgg.get(c.id as string) ?? { total: 0, qualified: 0, randomized: 0 }
    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as CampaignStatus,
      campaign_type: c.campaign_type as CampaignType,
      utm_campaign: (c.utm_campaign as string | null) ?? null,
      target_leads: (c.target_leads as number | null) ?? null,
      target_enrollments: (c.target_enrollments as number | null) ?? null,
      start_date: (c.start_date as string | null) ?? null,
      end_date: (c.end_date as string | null) ?? null,
      created_at: c.created_at as string,
      linked_study_count: studyCountMap.get(c.id as string) ?? 0,
      leads_generated: agg.total,
      qualified_leads: agg.qualified,
      randomized_subjects: agg.randomized,
    }
  })
}

// ---------------------------------------------------------------------------
// loadCampaignDetail
// ---------------------------------------------------------------------------

export async function loadCampaignDetail(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
): Promise<CampaignDetail | null> {
  // Query 1: fetch campaign — verify org ownership
  const { data: campaign, error: campaignError } = await supabase
    .from('recruitment_campaigns')
    .select('id, name, status, campaign_type, utm_campaign, target_leads, target_enrollments, start_date, end_date, created_at, description, organization_id')
    .eq('id', campaignId)
    .single() as { data: Record<string, unknown> | null; error: unknown }

  if (campaignError || !campaign) return null
  if (campaign.organization_id !== organizationId) return null

  // Query 2: linked studies with names
  const { data: studyRows } = await supabase
    .from('campaign_studies')
    .select('study_id, target_leads, target_enrollments, studies(id, name)')
    .eq('campaign_id', campaignId) as {
    data: {
      study_id: string
      target_leads: number | null
      target_enrollments: number | null
      studies: { id: string; name: string } | { id: string; name: string }[] | null
    }[] | null
  }

  // Query 3: lead stage counts for this campaign
  const { data: stageRows } = await supabase
    .from('patient_leads')
    .select('stage')
    .eq('campaign_id', campaignId)
    .is('archived_at', null) as { data: { stage: string }[] | null }

  // Query 4: top utm_source and utm_medium
  const { data: utmRows } = await supabase
    .from('patient_leads')
    .select('utm_source, utm_medium')
    .eq('campaign_id', campaignId)
    .is('archived_at', null) as { data: { utm_source: string | null; utm_medium: string | null }[] | null }

  // Compute stage metrics
  let leads_generated = 0
  let qualified_leads = 0
  let randomized_subjects = 0
  let screened_count = 0

  for (const row of stageRows ?? []) {
    leads_generated++
    if (QUALIFIED_STAGES.has(row.stage)) qualified_leads++
    if (row.stage === 'randomized') randomized_subjects++
    if (row.stage === 'screened') screened_count++
  }

  // Aggregate UTM sources (top 5 by count)
  const sourceMap = new Map<string | null, number>()
  const mediumMap = new Map<string | null, number>()

  for (const row of utmRows ?? []) {
    const src = row.utm_source ?? null
    const med = row.utm_medium ?? null
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1)
    mediumMap.set(med, (mediumMap.get(med) ?? 0) + 1)
  }

  const top_sources = Array.from(sourceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([utm_source, count]) => ({ utm_source, count }))

  const top_mediums = Array.from(mediumMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([utm_medium, count]) => ({ utm_medium, count }))

  // Map linked studies
  const linked_studies = (studyRows ?? []).map((row) => {
    const study = Array.isArray(row.studies) ? row.studies[0] : row.studies
    return {
      study_id: row.study_id,
      study_name: study?.name ?? row.study_id,
      target_leads: row.target_leads ?? null,
      target_enrollments: row.target_enrollments ?? null,
    }
  })

  return {
    id: campaign.id as string,
    name: campaign.name as string,
    status: campaign.status as CampaignStatus,
    campaign_type: campaign.campaign_type as CampaignType,
    utm_campaign: (campaign.utm_campaign as string | null) ?? null,
    target_leads: (campaign.target_leads as number | null) ?? null,
    target_enrollments: (campaign.target_enrollments as number | null) ?? null,
    start_date: (campaign.start_date as string | null) ?? null,
    end_date: (campaign.end_date as string | null) ?? null,
    created_at: campaign.created_at as string,
    description: (campaign.description as string | null) ?? null,
    linked_study_count: linked_studies.length,
    leads_generated,
    qualified_leads,
    randomized_subjects,
    screened_count,
    linked_studies,
    top_sources,
    top_mediums,
  }
}
