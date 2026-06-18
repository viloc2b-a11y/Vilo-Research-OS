import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  normalizePhone,
  deriveTier,
  deriveSourceChannel,
  intakeLead,
} from '@/lib/crm/intake-lead'
import type { IntakeLeadPayload } from '@/lib/crm/intake-lead'

// ---------------------------------------------------------------------------
// Helpers: normalizePhone
// ---------------------------------------------------------------------------

describe('normalizePhone', () => {
  test('strips non-digits and leading US country code from formatted number', () => {
    expect(normalizePhone('+1 (713) 555-1234')).toBe('7135551234')
  })

  test('leaves 10-digit number unchanged', () => {
    expect(normalizePhone('7135551234')).toBe('7135551234')
  })

  test('strips leading 1 from 11-digit US number', () => {
    expect(normalizePhone('17135551234')).toBe('7135551234')
  })
})

// ---------------------------------------------------------------------------
// Helpers: deriveTier
// ---------------------------------------------------------------------------

describe('deriveTier', () => {
  test('score 20 → high', () => {
    expect(deriveTier(20)).toBe('high')
  })

  test('score 16 → high (lower boundary)', () => {
    expect(deriveTier(16)).toBe('high')
  })

  test('score 10 → medium (lower boundary)', () => {
    expect(deriveTier(10)).toBe('medium')
  })

  test('score 7 → waitlist', () => {
    expect(deriveTier(7)).toBe('waitlist')
  })

  test('null → waitlist', () => {
    expect(deriveTier(null)).toBe('waitlist')
  })
})

// ---------------------------------------------------------------------------
// Helpers: deriveSourceChannel
// ---------------------------------------------------------------------------

describe('deriveSourceChannel', () => {
  test('ref_code resolved → referral_partner', () => {
    expect(
      deriveSourceChannel({ refCode: 'X', refResolved: true, utmCampaignResolved: false })
    ).toBe('referral_partner')
  })

  test('ref_code present but not resolved → shared', () => {
    expect(
      deriveSourceChannel({ refCode: 'X', refResolved: false, utmSource: undefined })
    ).toBe('shared')
  })

  test('utm_source organic → organic_seo', () => {
    expect(deriveSourceChannel({ utmSource: 'organic' })).toBe('organic_seo')
  })

  test('no attribution signals → direct', () => {
    expect(deriveSourceChannel({})).toBe('direct')
  })
})

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Supabase chainable mock. Each table gets its own mock
 * so tests can control responses per-table independently.
 */
function makeSupabaseMock(config: {
  orgExists?: boolean
  existingLead?: { id: string; prescreen_score: number | null } | null
  campaignId?: string | null
  referralId?: string | null
  insertedId?: string
}) {
  const {
    orgExists = true,
    existingLead = null,
    campaignId = null,
    referralId = null,
    insertedId = 'new-lead-uuid',
  } = config

  // In Supabase v2, .insert(...).select().single() is used.
  // The chain returns an object with .select() → .single() → resolves with the row.
  const singleAfterInsert = vi.fn().mockResolvedValue({
    data: { id: insertedId },
    error: null,
  })
  const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert })
  const insertMock = vi.fn().mockReturnValue({ select: selectAfterInsert })

  const selectMock = vi.fn()

  // eq chain returns an object with further chainable methods
  const buildChain = (terminalValue: unknown) => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.neq = vi.fn().mockReturnValue(chain)
    chain.in = vi.fn().mockReturnValue(chain)
    chain.not = vi.fn().mockReturnValue(chain)
    chain.is = vi.fn().mockReturnValue(chain)
    chain.limit = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue(terminalValue)
    chain.select = vi.fn().mockReturnValue(chain)
    chain.insert = insertMock
    void self
    return chain
  }

  const orgChain = buildChain(
    orgExists
      ? { data: { id: 'org-uuid-123' }, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } }
  )

  const leadChain = buildChain(
    existingLead
      ? { data: existingLead, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } }
  )

  const campaignChain = buildChain(
    campaignId
      ? { data: { id: campaignId }, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } }
  )

  // referral_code lookup added in migration 0219 — resolveReferral now actually queries
  const referralChain = buildChain(
    referralId
      ? { data: { id: referralId }, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } }
  )

  selectMock.mockImplementation(function (this: { _table: string }) {
    return this._table === 'organizations'
      ? orgChain
      : this._table === 'patient_leads'
        ? leadChain
        : this._table === 'recruitment_campaigns'
          ? campaignChain
          : referralChain
  })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    const tableChain = {
      _table: table,
      select: selectMock.bind({ _table: table }),
      insert: insertMock,
    }

    // Route to the correct chain
    if (table === 'organizations') return { ...orgChain, _table: table, insert: insertMock }
    if (table === 'patient_leads') return { ...leadChain, _table: table, insert: insertMock }
    if (table === 'recruitment_campaigns') return { ...campaignChain, _table: table, insert: insertMock }
    if (table === 'contact_referral_relationships') return { ...referralChain, _table: table, insert: insertMock }

    return tableChain
  })

  return { from: fromMock, _insertMock: insertMock }
}

// ---------------------------------------------------------------------------
// Base valid payload
// ---------------------------------------------------------------------------

const BASE_PAYLOAD: IntakeLeadPayload = {
  organization_id: 'org-uuid-123',
  first_name: 'Maria',
  last_name: 'Santos',
  phone: '7135551234',
  email: 'maria@example.com',
  sms_opt_in: true,
  symptom_match: true,
  duration_meets_threshold: true,
  age: 45,
  within_service_area: true,
  diagnosis_confirmed: true,
  availability_confirmed: true,
}

// ---------------------------------------------------------------------------
// intakeLead integration tests
// ---------------------------------------------------------------------------

describe('intakeLead', () => {
  test('valid payload, org found, no duplicate, no campaign → inserts lead, returns ok result', async () => {
    const { from, _insertMock } = makeSupabaseMock({ insertedId: 'new-lead-uuid' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, BASE_PAYLOAD)

    expect(result).toMatchObject({
      ok: true,
      lead_id: 'new-lead-uuid',
      tier: 'high',
      duplicate: false,
    })
    expect(_insertMock).toHaveBeenCalledOnce()
  })

  test('duplicate: existing active lead → returns existing lead_id with duplicate:true, no insert', async () => {
    const { from, _insertMock } = makeSupabaseMock({
      existingLead: { id: 'existing-uuid', prescreen_score: 14 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, BASE_PAYLOAD)

    expect(result).toMatchObject({
      ok: true,
      lead_id: 'existing-uuid',
      tier: 'medium',
      duplicate: true,
    })
    expect(_insertMock).not.toHaveBeenCalled()
  })

  test('org_id not found → returns ORG_NOT_FOUND, no insert', async () => {
    const { from, _insertMock } = makeSupabaseMock({ orgExists: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, BASE_PAYLOAD)

    expect(result).toMatchObject({ ok: false, error: 'ORG_NOT_FOUND' })
    expect(_insertMock).not.toHaveBeenCalled()
  })

  test('utm_campaign matches active campaign → inserts with campaign_id set', async () => {
    const { from, _insertMock } = makeSupabaseMock({ campaignId: 'campaign-uuid-abc' })
    const payload: IntakeLeadPayload = { ...BASE_PAYLOAD, utm_campaign: 'summer2025' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, payload)

    expect(result.ok).toBe(true)
    // Insert must have been called with campaign_id
    const insertArgs = _insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(insertArgs).toMatchObject({ campaign_id: 'campaign-uuid-abc' })
  })

  test('hard-fail lead (age out of range) → inserted with score 0, tier waitlist', async () => {
    const { from, _insertMock } = makeSupabaseMock({ insertedId: 'hardfail-uuid' })
    const payload: IntakeLeadPayload = { ...BASE_PAYLOAD, age: 5 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, payload)

    expect(result).toMatchObject({
      ok: true,
      lead_id: 'hardfail-uuid',
      tier: 'waitlist',
      duplicate: false,
    })
    expect(_insertMock).toHaveBeenCalledOnce()
    const insertArgs = _insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(insertArgs).toMatchObject({ prescreen_score: 0 })
  })

  test('ref_code matches active referral relationship → inserts with referral_relationship_id set', async () => {
    const { from, _insertMock } = makeSupabaseMock({ referralId: 'referral-uuid-xyz' })
    const payload: IntakeLeadPayload = { ...BASE_PAYLOAD, ref_code: 'PARTNERCODE1' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, payload)

    expect(result.ok).toBe(true)
    const insertArgs = _insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(insertArgs).toMatchObject({
      referral_relationship_id: 'referral-uuid-xyz',
      recruitment_source_channel: 'referral_partner',
    })
  })

  test('ref_code undefined → resolveReferral returns null without querying DB', async () => {
    const { from, _insertMock } = makeSupabaseMock({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, BASE_PAYLOAD)

    expect(result.ok).toBe(true)
    const insertArgs = _insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(insertArgs).toMatchObject({ referral_relationship_id: null })
  })

  test('ref_code provided but no matching active referral → referral_relationship_id is null, channel is shared', async () => {
    const { from, _insertMock } = makeSupabaseMock({ referralId: null })
    const payload: IntakeLeadPayload = { ...BASE_PAYLOAD, ref_code: 'UNKNOWN_CODE' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, payload)

    expect(result.ok).toBe(true)
    const insertArgs = _insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(insertArgs).toMatchObject({
      referral_relationship_id: null,
      recruitment_source_channel: 'shared',
    })
  })

  test('utm_source and utm_medium are stored on the created lead record', async () => {
    const { from, _insertMock } = makeSupabaseMock({ insertedId: 'utm-lead-uuid' })
    const payload: IntakeLeadPayload = {
      ...BASE_PAYLOAD,
      utm_source: 'facebook',
      utm_medium: 'cpc',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await intakeLead({ from } as any, payload)

    expect(result.ok).toBe(true)
    const insertArgs = _insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(insertArgs).toMatchObject({
      utm_source: 'facebook',
      utm_medium: 'cpc',
    })
  })
})
