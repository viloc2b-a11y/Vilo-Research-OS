import { describe, test, expect } from 'vitest'
import { loadPartnerList, loadPartnerDetail } from '@/lib/crm/partner-management'
import { loadCampaignList, loadCampaignDetail } from '@/lib/crm/campaign-management'

// ---------------------------------------------------------------------------
// Supabase mock helpers (same pattern as campaign-management.test.ts)
// ---------------------------------------------------------------------------

function makeChainedMock(calls: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0

  const methods = ['from', 'select', 'eq', 'is', 'in', 'order', 'single', 'upsert', 'delete', 'update', 'insert', 'limit']

  const root: Record<string, ReturnType<typeof import('vitest').vi.fn>> = {}
  for (const key of methods) {
    root[key] = (() => {}) as ReturnType<typeof import('vitest').vi.fn>
  }

  root.from = (() => {
    const chain: Record<string, unknown> = {}
    for (const key of methods) {
      chain[key] = () => chain
    }
    ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
      const result = calls[callIndex] ?? { data: null, error: null }
      callIndex++
      resolve(result)
      return Promise.resolve(result)
    }
    return chain
  }) as ReturnType<typeof import('vitest').vi.fn>

  // Wrap in a proper mock-returning function
  return buildMock(calls)
}

function buildMock(calls: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0

  const methods = ['from', 'select', 'eq', 'is', 'in', 'order', 'single', 'upsert', 'delete', 'update', 'insert', 'limit']

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    for (const key of methods) {
      chain[key] = () => chain
    }
    ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
      const result = calls[callIndex] ?? { data: null, error: null }
      callIndex++
      resolve(result)
      return Promise.resolve(result)
    }
    return chain
  }

  const root: Record<string, unknown> = {}
  for (const key of methods) {
    root[key] = () => root
  }
  root.from = () => makeChain()

  return root
}

// ---------------------------------------------------------------------------
// loadPartnerList
// ---------------------------------------------------------------------------

describe('loadPartnerList', () => {
  test('returns mapped partners with lead counts aggregated from linked campaigns', async () => {
    const partners = [
      {
        id: 'p1',
        name: 'Acme Agency',
        partner_type: 'digital_agency',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    // Campaigns linked to p1
    const campaignRows = [
      { id: 'c1', partner_id: 'p1' },
      { id: 'c2', partner_id: 'p1' },
    ]

    // Leads for c1 and c2
    const leadRows = [
      { campaign_id: 'c1', stage: 'lead' },
      { campaign_id: 'c1', stage: 'qualified' },
      { campaign_id: 'c1', stage: 'randomized' },
      { campaign_id: 'c2', stage: 'lead' },
      { campaign_id: 'c2', stage: 'screened' },
    ]

    const supabase = buildMock([
      { data: partners, error: null },       // Q1: partners
      { data: campaignRows, error: null },   // Q2: campaigns
      { data: leadRows, error: null },       // Q3: leads
    ])

    const result = await loadPartnerList(
      supabase as unknown as Parameters<typeof loadPartnerList>[0],
      'org-1',
    )

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(result[0].name).toBe('Acme Agency')
    expect(result[0].linked_campaign_count).toBe(2)
    expect(result[0].total_leads).toBe(5)
    // qualified: qualified(c1) + randomized(c1) + screened(c2) = 3
    expect(result[0].qualified_leads).toBe(3)
    // randomized: 1 (c1)
    expect(result[0].randomized_subjects).toBe(1)
  })

  test('returns empty array when no partners exist', async () => {
    const supabase = buildMock([
      { data: [], error: null },
    ])

    const result = await loadPartnerList(
      supabase as unknown as Parameters<typeof loadPartnerList>[0],
      'org-1',
    )

    expect(result).toEqual([])
  })

  test('partner with no linked campaigns has zeros for all metrics', async () => {
    const partners = [
      {
        id: 'p1',
        name: 'Solo Partner',
        partner_type: 'hospital',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const supabase = buildMock([
      { data: partners, error: null },     // Q1: partners
      { data: [], error: null },           // Q2: no campaigns
      // Q3 skipped — no campaign IDs to query
    ])

    const result = await loadPartnerList(
      supabase as unknown as Parameters<typeof loadPartnerList>[0],
      'org-1',
    )

    expect(result).toHaveLength(1)
    expect(result[0].linked_campaign_count).toBe(0)
    expect(result[0].total_leads).toBe(0)
    expect(result[0].qualified_leads).toBe(0)
    expect(result[0].randomized_subjects).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// loadPartnerDetail
// ---------------------------------------------------------------------------

describe('loadPartnerDetail', () => {
  test('returns full detail with linked campaigns + sources', async () => {
    const partner = {
      id: 'p1',
      name: 'Acme Agency',
      partner_type: 'digital_agency',
      status: 'active',
      contact_name: 'Jane Smith',
      contact_email: 'jane@acme.com',
      contact_phone: '+1 555-0100',
      notes: 'Key digital partner',
      created_at: '2026-01-01T00:00:00Z',
      organization_id: 'org-1',
    }

    const campaignRows = [
      { id: 'c1', name: 'Q1 Campaign', status: 'active', campaign_type: 'digital_paid', budget_amount: 5000 },
    ]

    const stageRows = [
      { campaign_id: 'c1', stage: 'lead' },
      { campaign_id: 'c1', stage: 'qualified' },
      { campaign_id: 'c1', stage: 'randomized' },
    ]

    const sourceRows = [
      { utm_source: 'facebook' },
      { utm_source: 'facebook' },
      { utm_source: 'google' },
    ]

    const supabase = buildMock([
      { data: partner, error: null },        // Q1: partner
      { data: campaignRows, error: null },   // Q2: campaigns
      { data: stageRows, error: null },      // Q3: stage counts
      { data: sourceRows, error: null },     // Q4: top sources
    ])

    const result = await loadPartnerDetail(
      supabase as unknown as Parameters<typeof loadPartnerDetail>[0],
      'org-1',
      'p1',
    )

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Acme Agency')
    expect(result!.contact_name).toBe('Jane Smith')
    expect(result!.contact_email).toBe('jane@acme.com')
    expect(result!.linked_campaigns).toHaveLength(1)
    expect(result!.linked_campaigns[0].name).toBe('Q1 Campaign')
    expect(result!.linked_campaigns[0].leads_generated).toBe(3)
    expect(result!.top_sources[0].utm_source).toBe('facebook')
    expect(result!.top_sources[0].count).toBe(2)
    expect(result!.total_leads).toBe(3)
    expect(result!.linked_campaign_count).toBe(1)
  })

  test('returns null when partnerId does not belong to org', async () => {
    const partner = {
      id: 'p1',
      name: 'Foreign Partner',
      partner_type: 'other',
      status: 'active',
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      organization_id: 'org-OTHER', // different org
    }

    const supabase = buildMock([
      { data: partner, error: null },
    ])

    const result = await loadPartnerDetail(
      supabase as unknown as Parameters<typeof loadPartnerDetail>[0],
      'org-1',
      'p1',
    )

    expect(result).toBeNull()
  })

  test('correctly computes qualified count using QUALIFIED_STAGES set', async () => {
    const partner = {
      id: 'p1',
      name: 'Stage Test Partner',
      partner_type: 'referral_network',
      status: 'active',
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      organization_id: 'org-1',
    }

    const campaignRows = [
      { id: 'c1', name: 'Campaign 1', status: 'active', campaign_type: 'digital_paid', budget_amount: null },
    ]

    // All five qualifying stages + non-qualifying stages
    const stageRows = [
      { campaign_id: 'c1', stage: 'qualified' },
      { campaign_id: 'c1', stage: 'scheduled' },
      { campaign_id: 'c1', stage: 'consented' },
      { campaign_id: 'c1', stage: 'screened' },
      { campaign_id: 'c1', stage: 'randomized' },
      { campaign_id: 'c1', stage: 'lead' },
      { campaign_id: 'c1', stage: 'contacted' },
    ]

    const supabase = buildMock([
      { data: partner, error: null },
      { data: campaignRows, error: null },
      { data: stageRows, error: null },
      { data: [], error: null }, // no source rows
    ])

    const result = await loadPartnerDetail(
      supabase as unknown as Parameters<typeof loadPartnerDetail>[0],
      'org-1',
      'p1',
    )

    expect(result).not.toBeNull()
    expect(result!.linked_campaigns[0].qualified_leads).toBe(5)
    expect(result!.linked_campaigns[0].randomized_subjects).toBe(1)
    expect(result!.linked_campaigns[0].leads_generated).toBe(7)
    // Rolled-up totals match
    expect(result!.qualified_leads).toBe(5)
    expect(result!.randomized_subjects).toBe(1)
    expect(result!.total_leads).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// Campaign regression tests — partner_id field
// ---------------------------------------------------------------------------

describe('Campaign regression — partner_id', () => {
  test('loadCampaignList still returns correctly when campaign has no partner_id', async () => {
    const campaigns = [
      {
        id: 'c1',
        name: 'Unaffiliated Campaign',
        status: 'active',
        campaign_type: 'digital_paid',
        utm_campaign: null,
        target_leads: null,
        target_enrollments: null,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01T00:00:00Z',
        budget_amount: null,
        // partner_id intentionally absent (null from DB)
      },
    ]

    const supabase = buildMock([
      { data: campaigns, error: null },  // campaigns
      { data: [], error: null },         // leads
      { data: [], error: null },         // studies
    ])

    const result = await loadCampaignList(
      supabase as unknown as Parameters<typeof loadCampaignList>[0],
      'org-1',
    )

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
    expect(result[0].leads_generated).toBe(0)
  })

  test('loadCampaignDetail includes partner_id field in returned object', async () => {
    const campaign = {
      id: 'c1',
      name: 'Partnered Campaign',
      status: 'active',
      campaign_type: 'digital_paid',
      utm_campaign: null,
      target_leads: null,
      target_enrollments: null,
      start_date: null,
      end_date: null,
      created_at: '2026-01-01T00:00:00Z',
      description: null,
      organization_id: 'org-1',
      budget_amount: null,
      partner_id: 'p1',
    }

    const supabase = buildMock([
      { data: campaign, error: null },  // Q1: campaign
      { data: [], error: null },        // Q2: studies
      { data: [], error: null },        // Q3: stages
      { data: [], error: null },        // Q4: utm rows
    ])

    const result = await loadCampaignDetail(
      supabase as unknown as Parameters<typeof loadCampaignDetail>[0],
      'org-1',
      'c1',
    )

    expect(result).not.toBeNull()
    expect(result!.partner_id).toBe('p1')
  })
})
