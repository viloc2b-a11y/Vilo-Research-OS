import { describe, test, expect, vi } from 'vitest'
import { loadCampaignList, loadCampaignDetail } from '@/lib/crm/campaign-management'

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Supabase query mock that resolves to { data, error }.
 * Supports multiple sequential calls returning different results.
 */
function makeChainedMock(calls: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0

  function makeChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}

    const methods = ['from', 'select', 'eq', 'is', 'in', 'order', 'single', 'upsert', 'delete', 'update', 'insert', 'limit']
    for (const key of methods) {
      chain[key] = vi.fn().mockReturnValue(chain)
    }

    ;(chain as unknown as { then: ReturnType<typeof vi.fn> }).then = vi.fn().mockImplementation(
      (resolve: (v: unknown) => unknown) => {
        const result = calls[callIndex] ?? { data: null, error: null }
        callIndex++
        resolve(result)
        return Promise.resolve(result)
      },
    )

    return chain
  }

  // The top-level mock: each call to .from() resets to a new chain that
  // closes over the shared callIndex
  const root: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'eq', 'is', 'in', 'order', 'single', 'upsert', 'delete', 'update', 'insert', 'limit']
  for (const key of methods) {
    root[key] = vi.fn()
  }

  // Each call to .from() begins a new chain
  root.from = vi.fn().mockImplementation(() => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const key of methods) {
      chain[key] = vi.fn().mockReturnValue(chain)
    }
    ;(chain as unknown as { then: ReturnType<typeof vi.fn> }).then = vi.fn().mockImplementation(
      (resolve: (v: unknown) => unknown) => {
        const result = calls[callIndex] ?? { data: null, error: null }
        callIndex++
        resolve(result)
        return Promise.resolve(result)
      },
    )
    return chain
  })

  return root
}

// ---------------------------------------------------------------------------
// loadCampaignList
// ---------------------------------------------------------------------------

describe('loadCampaignList', () => {
  test('returns mapped list with lead counts merged correctly', async () => {
    const campaigns = [
      {
        id: 'c1',
        name: 'Campaign Alpha',
        status: 'active',
        campaign_type: 'digital_paid',
        utm_campaign: 'alpha_2026',
        target_leads: 100,
        target_enrollments: 10,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const leadRows = [
      { campaign_id: 'c1', stage: 'lead' },
      { campaign_id: 'c1', stage: 'qualified' },
      { campaign_id: 'c1', stage: 'screened' },
      { campaign_id: 'c1', stage: 'randomized' },
    ]

    const studyRows = [
      { campaign_id: 'c1' },
      { campaign_id: 'c1' },
    ]

    const supabase = makeChainedMock([
      { data: campaigns, error: null },
      { data: leadRows, error: null },
      { data: studyRows, error: null },
    ])

    const result = await loadCampaignList(
      supabase as unknown as Parameters<typeof loadCampaignList>[0],
      'org-1',
    )

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
    expect(result[0].name).toBe('Campaign Alpha')
    expect(result[0].leads_generated).toBe(4)
    // qualified = qualified + screened + randomized = 3
    expect(result[0].qualified_leads).toBe(3)
    expect(result[0].randomized_subjects).toBe(1)
    expect(result[0].linked_study_count).toBe(2)
  })

  test('returns empty array when no campaigns exist', async () => {
    const supabase = makeChainedMock([
      { data: [], error: null },
    ])

    const result = await loadCampaignList(
      supabase as unknown as Parameters<typeof loadCampaignList>[0],
      'org-1',
    )

    expect(result).toEqual([])
  })

  test('status filter is applied when provided', async () => {
    // Only one campaign returned from DB (as if status filter was applied)
    const campaigns = [
      {
        id: 'c2',
        name: 'Paused Campaign',
        status: 'paused',
        campaign_type: 'organic_seo',
        utm_campaign: null,
        target_leads: null,
        target_enrollments: null,
        start_date: null,
        end_date: null,
        created_at: '2026-02-01T00:00:00Z',
      },
    ]

    const supabase = makeChainedMock([
      { data: campaigns, error: null },
      { data: [], error: null }, // no leads
      { data: [], error: null }, // no study links
    ])

    const result = await loadCampaignList(
      supabase as unknown as Parameters<typeof loadCampaignList>[0],
      'org-1',
      'paused',
    )

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('paused')
  })
})

// ---------------------------------------------------------------------------
// loadCampaignDetail
// ---------------------------------------------------------------------------

describe('loadCampaignDetail', () => {
  test('returns full detail with linked studies + source breakdown', async () => {
    const campaign = {
      id: 'c1',
      name: 'Alpha Campaign',
      status: 'active',
      campaign_type: 'digital_paid',
      utm_campaign: 'alpha',
      target_leads: 100,
      target_enrollments: 10,
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      created_at: '2026-01-01T00:00:00Z',
      description: 'Test campaign',
      organization_id: 'org-1',
    }

    const studyRows = [
      {
        study_id: 's1',
        target_leads: 50,
        target_enrollments: 5,
        studies: { id: 's1', name: 'Study Gamma' },
      },
    ]

    const stageRows = [
      { stage: 'lead' },
      { stage: 'qualified' },
      { stage: 'randomized' },
    ]

    const utmRows = [
      { utm_source: 'facebook', utm_medium: 'cpc' },
      { utm_source: 'facebook', utm_medium: 'cpc' },
      { utm_source: 'google', utm_medium: 'cpm' },
    ]

    const supabase = makeChainedMock([
      { data: campaign, error: null },
      { data: studyRows, error: null },
      { data: stageRows, error: null },
      { data: utmRows, error: null },
    ])

    const result = await loadCampaignDetail(
      supabase as unknown as Parameters<typeof loadCampaignDetail>[0],
      'org-1',
      'c1',
    )

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Alpha Campaign')
    expect(result!.description).toBe('Test campaign')
    expect(result!.linked_studies).toHaveLength(1)
    expect(result!.linked_studies[0].study_name).toBe('Study Gamma')
    expect(result!.top_sources[0].utm_source).toBe('facebook')
    expect(result!.top_sources[0].count).toBe(2)
    expect(result!.top_mediums[0].utm_medium).toBe('cpc')
    expect(result!.top_mediums[0].count).toBe(2)
  })

  test('returns null when campaignId does not belong to org', async () => {
    const campaign = {
      id: 'c1',
      name: 'Foreign Campaign',
      status: 'active',
      campaign_type: 'internal',
      utm_campaign: null,
      target_leads: null,
      target_enrollments: null,
      start_date: null,
      end_date: null,
      created_at: '2026-01-01T00:00:00Z',
      description: null,
      organization_id: 'org-OTHER', // different org
    }

    const supabase = makeChainedMock([
      { data: campaign, error: null },
    ])

    const result = await loadCampaignDetail(
      supabase as unknown as Parameters<typeof loadCampaignDetail>[0],
      'org-1',
      'c1',
    )

    expect(result).toBeNull()
  })

  test('screened/qualified/randomized counts computed correctly from stage data', async () => {
    const campaign = {
      id: 'c1',
      name: 'Stage Test',
      status: 'active',
      campaign_type: 'referral_partner',
      utm_campaign: null,
      target_leads: null,
      target_enrollments: null,
      start_date: null,
      end_date: null,
      created_at: '2026-01-01T00:00:00Z',
      description: null,
      organization_id: 'org-1',
    }

    const stageRows = [
      { stage: 'lead' },
      { stage: 'contacted' },
      { stage: 'qualified' },
      { stage: 'scheduled' },
      { stage: 'consented' },
      { stage: 'screened' },
      { stage: 'randomized' },
    ]

    const supabase = makeChainedMock([
      { data: campaign, error: null },
      { data: [], error: null },     // no linked studies
      { data: stageRows, error: null },
      { data: [], error: null },     // no utm rows
    ])

    const result = await loadCampaignDetail(
      supabase as unknown as Parameters<typeof loadCampaignDetail>[0],
      'org-1',
      'c1',
    )

    expect(result).not.toBeNull()
    expect(result!.leads_generated).toBe(7)
    // screened = only 'screened' stage
    expect(result!.screened_count).toBe(1)
    // randomized = only 'randomized' stage
    expect(result!.randomized_subjects).toBe(1)
    // qualified = qualified + scheduled + consented + screened + randomized = 5
    expect(result!.qualified_leads).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Campaign metric mapping — boundary tests
// ---------------------------------------------------------------------------

describe('Campaign metric mapping', () => {
  test('qualified includes all stages from qualified onward', async () => {
    const campaign = {
      id: 'c1',
      name: 'Boundary Test',
      status: 'active',
      campaign_type: 'internal',
      utm_campaign: null,
      target_leads: null,
      target_enrollments: null,
      start_date: null,
      end_date: null,
      created_at: '2026-01-01T00:00:00Z',
      description: null,
      organization_id: 'org-1',
    }

    // One of each qualifying stage
    const stageRows = [
      { stage: 'qualified' },
      { stage: 'scheduled' },
      { stage: 'consented' },
      { stage: 'screened' },
      { stage: 'randomized' },
      // these should NOT count
      { stage: 'lead' },
      { stage: 'contacted' },
      { stage: 'pre_screen' },
    ]

    const supabase = makeChainedMock([
      { data: campaign, error: null },
      { data: [], error: null },
      { data: stageRows, error: null },
      { data: [], error: null },
    ])

    const result = await loadCampaignDetail(
      supabase as unknown as Parameters<typeof loadCampaignDetail>[0],
      'org-1',
      'c1',
    )

    expect(result!.qualified_leads).toBe(5) // exactly the 5 qualifying stages
    expect(result!.leads_generated).toBe(8) // all 8
  })

  test('randomized is only the randomized stage', async () => {
    const campaign = {
      id: 'c1',
      name: 'Randomized Boundary',
      status: 'active',
      campaign_type: 'internal',
      utm_campaign: null,
      target_leads: null,
      target_enrollments: null,
      start_date: null,
      end_date: null,
      created_at: '2026-01-01T00:00:00Z',
      description: null,
      organization_id: 'org-1',
    }

    const stageRows = [
      { stage: 'randomized' },
      { stage: 'randomized' },
      { stage: 'screened' },    // NOT randomized
      { stage: 'qualified' },   // NOT randomized
    ]

    const supabase = makeChainedMock([
      { data: campaign, error: null },
      { data: [], error: null },
      { data: stageRows, error: null },
      { data: [], error: null },
    ])

    const result = await loadCampaignDetail(
      supabase as unknown as Parameters<typeof loadCampaignDetail>[0],
      'org-1',
      'c1',
    )

    expect(result!.randomized_subjects).toBe(2)
    expect(result!.screened_count).toBe(1)
  })
})
