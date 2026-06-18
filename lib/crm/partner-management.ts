import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PartnerType =
  | 'digital_agency'
  | 'media_buyer'
  | 'community_org'
  | 'physician_group'
  | 'hospital'
  | 'referral_network'
  | 'patient_advocacy'
  | 'employer'
  | 'other'

export type PartnerStatus = 'active' | 'paused' | 'inactive'

export type PartnerListItem = {
  id: string
  name: string
  partner_type: PartnerType
  status: PartnerStatus
  linked_campaign_count: number
  total_leads: number
  qualified_leads: number
  randomized_subjects: number
  created_at: string
}

export type PartnerDetail = PartnerListItem & {
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  linked_campaigns: {
    id: string
    name: string
    status: string
    campaign_type: string
    leads_generated: number
    qualified_leads: number
    randomized_subjects: number
    budget_amount: number | null
  }[]
  top_sources: { utm_source: string | null; count: number }[]
}

// ---------------------------------------------------------------------------
// Qualified-stage set (mirrors campaign-management.ts)
// ---------------------------------------------------------------------------

const QUALIFIED_STAGES = new Set([
  'qualified',
  'scheduled',
  'consented',
  'screened',
  'randomized',
])

// ---------------------------------------------------------------------------
// loadPartnerList
// ---------------------------------------------------------------------------

export async function loadPartnerList(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PartnerListItem[]> {
  // Query 1: fetch all partners for the org
  const { data: partners, error: partnerError } = await supabase
    .from('recruitment_partners')
    .select('id, name, partner_type, status, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false }) as {
    data: { id: string; name: string; partner_type: string; status: string; created_at: string }[] | null
    error: unknown
  }

  if (partnerError || !partners || partners.length === 0) {
    return []
  }

  const partnerIds = partners.map((p) => p.id)

  // Query 2: fetch campaigns linked to these partners
  const { data: campaignRows } = await supabase
    .from('recruitment_campaigns')
    .select('id, partner_id')
    .in('partner_id', partnerIds) as {
    data: { id: string; partner_id: string }[] | null
  }

  const linkedCampaignIds = (campaignRows ?? []).map((c) => c.id)

  // Query 3: lead stage counts for all linked campaign IDs
  let leadRows: { campaign_id: string; stage: string }[] = []
  if (linkedCampaignIds.length > 0) {
    const { data } = await supabase
      .from('patient_leads')
      .select('campaign_id, stage')
      .in('campaign_id', linkedCampaignIds)
      .is('archived_at', null) as { data: { campaign_id: string; stage: string }[] | null }
    leadRows = data ?? []
  }

  // Build campaign_id → partner_id map
  const campaignToPartner = new Map<string, string>()
  for (const row of campaignRows ?? []) {
    campaignToPartner.set(row.id, row.partner_id)
  }

  // Aggregate campaign counts per partner
  const campaignCountMap = new Map<string, number>()
  for (const row of campaignRows ?? []) {
    const pid = row.partner_id
    campaignCountMap.set(pid, (campaignCountMap.get(pid) ?? 0) + 1)
  }

  // Aggregate lead metrics per partner (via campaign_id → partner_id)
  type LeadAgg = { total: number; qualified: number; randomized: number }
  const leadAgg = new Map<string, LeadAgg>()

  for (const row of leadRows) {
    const partnerId = campaignToPartner.get(row.campaign_id)
    if (!partnerId) continue
    if (!leadAgg.has(partnerId)) {
      leadAgg.set(partnerId, { total: 0, qualified: 0, randomized: 0 })
    }
    const agg = leadAgg.get(partnerId)!
    agg.total++
    if (QUALIFIED_STAGES.has(row.stage)) agg.qualified++
    if (row.stage === 'randomized') agg.randomized++
  }

  // Merge
  return partners.map((p) => {
    const agg = leadAgg.get(p.id) ?? { total: 0, qualified: 0, randomized: 0 }
    return {
      id: p.id,
      name: p.name,
      partner_type: p.partner_type as PartnerType,
      status: p.status as PartnerStatus,
      linked_campaign_count: campaignCountMap.get(p.id) ?? 0,
      total_leads: agg.total,
      qualified_leads: agg.qualified,
      randomized_subjects: agg.randomized,
      created_at: p.created_at,
    }
  })
}

// ---------------------------------------------------------------------------
// loadPartnerDetail
// ---------------------------------------------------------------------------

export async function loadPartnerDetail(
  supabase: SupabaseClient,
  organizationId: string,
  partnerId: string,
): Promise<PartnerDetail | null> {
  // Query 1: fetch partner — verify org ownership
  const { data: partner, error: partnerError } = await supabase
    .from('recruitment_partners')
    .select('id, name, partner_type, status, contact_name, contact_email, contact_phone, notes, created_at, organization_id')
    .eq('id', partnerId)
    .single() as { data: Record<string, unknown> | null; error: unknown }

  if (partnerError || !partner) return null
  if (partner.organization_id !== organizationId) return null

  // Query 2: linked campaigns for this partner
  const { data: campaignRows } = await supabase
    .from('recruitment_campaigns')
    .select('id, name, status, campaign_type, budget_amount')
    .eq('partner_id', partnerId) as {
    data: {
      id: string
      name: string
      status: string
      campaign_type: string
      budget_amount: number | null
    }[] | null
  }

  const campaigns = campaignRows ?? []
  const campaignIds = campaigns.map((c) => c.id)

  // Query 3: lead stage counts for this partner's campaigns
  let stageRows: { campaign_id: string; stage: string }[] = []
  if (campaignIds.length > 0) {
    const { data } = await supabase
      .from('patient_leads')
      .select('campaign_id, stage')
      .in('campaign_id', campaignIds)
      .is('archived_at', null) as { data: { campaign_id: string; stage: string }[] | null }
    stageRows = data ?? []
  }

  // Query 4: top 5 utm_source from partner's campaign leads
  let sourceRows: { utm_source: string | null }[] = []
  if (campaignIds.length > 0) {
    const { data } = await supabase
      .from('patient_leads')
      .select('utm_source')
      .in('campaign_id', campaignIds)
      .is('archived_at', null) as { data: { utm_source: string | null }[] | null }
    sourceRows = data ?? []
  }

  // Aggregate per-campaign lead metrics
  type CampaignLeadAgg = { total: number; qualified: number; randomized: number }
  const campaignLeadAgg = new Map<string, CampaignLeadAgg>()

  for (const row of stageRows) {
    const cid = row.campaign_id
    if (!campaignLeadAgg.has(cid)) {
      campaignLeadAgg.set(cid, { total: 0, qualified: 0, randomized: 0 })
    }
    const agg = campaignLeadAgg.get(cid)!
    agg.total++
    if (QUALIFIED_STAGES.has(row.stage)) agg.qualified++
    if (row.stage === 'randomized') agg.randomized++
  }

  // Build linked_campaigns array
  const linked_campaigns = campaigns.map((c) => {
    const agg = campaignLeadAgg.get(c.id) ?? { total: 0, qualified: 0, randomized: 0 }
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      campaign_type: c.campaign_type,
      leads_generated: agg.total,
      qualified_leads: agg.qualified,
      randomized_subjects: agg.randomized,
      budget_amount: c.budget_amount ?? null,
    }
  })

  // Aggregate top utm_sources (top 5 by count)
  const sourceMap = new Map<string | null, number>()
  for (const row of sourceRows) {
    const src = row.utm_source ?? null
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1)
  }

  const top_sources = Array.from(sourceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([utm_source, count]) => ({ utm_source, count }))

  // Roll up totals across all linked campaigns
  let total_leads = 0
  let qualified_leads = 0
  let randomized_subjects = 0
  for (const c of linked_campaigns) {
    total_leads += c.leads_generated
    qualified_leads += c.qualified_leads
    randomized_subjects += c.randomized_subjects
  }

  return {
    id: partner.id as string,
    name: partner.name as string,
    partner_type: partner.partner_type as PartnerType,
    status: partner.status as PartnerStatus,
    contact_name: (partner.contact_name as string | null) ?? null,
    contact_email: (partner.contact_email as string | null) ?? null,
    contact_phone: (partner.contact_phone as string | null) ?? null,
    notes: (partner.notes as string | null) ?? null,
    created_at: partner.created_at as string,
    linked_campaign_count: linked_campaigns.length,
    total_leads,
    qualified_leads,
    randomized_subjects,
    linked_campaigns,
    top_sources,
  }
}
