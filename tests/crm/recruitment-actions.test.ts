import { describe, test, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock next/navigation and next/cache before importing the actions module
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock createServerClient — actions call this internally
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// Mock auth guards — we test the action logic, not auth plumbing
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'actor-user-1' }),
  getOrganizationMemberships: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/rbac/permissions', () => ({
  canAccessPatientCRM: vi.fn().mockReturnValue(true),
  canManagePatientCRM: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/auth/membership-access', () => ({
  hasActiveOrganizationMembership: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/crm/lead-stage-history', () => ({
  recordLeadStageTransition: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/crm/link-lead-to-subject', () => ({
  linkLeadToSubject: vi.fn().mockResolvedValue({ ok: true }),
}))

import { createServerClient } from '@/lib/supabase/server'
import { recordLeadStageTransition } from '@/lib/crm/lead-stage-history'
import { linkLeadToSubject } from '@/lib/crm/link-lead-to-subject'
import {
  logLeadContactAttemptAction,
  qualifyLeadAction,
  assignLeadStudyAction,
  convertLeadToSubjectAction,
  scheduleLeadFollowUpAction,
} from '@/lib/crm/recruitment-actions'

// ---------------------------------------------------------------------------
// Supabase chain builder
// ---------------------------------------------------------------------------

// A Supabase client mock whose query builder is thenable, but whose top-level
// client is NOT thenable. If the client itself has a `then`, mockResolvedValue
// assimilates it and `await createServerClient()` resolves to the query result
// instead of the client. That is the bug these action tests were hitting.
function makeChain() {
  const defaultResolved = { data: null, error: null }

  const query = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    single: vi.fn().mockResolvedValue(defaultResolved),
    maybeSingle: vi.fn().mockResolvedValue(defaultResolved),
    // Thenable — resolves when the query is awaited directly (e.g. update().eq().eq())
    then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      resolve(defaultResolved)
      return Promise.resolve(defaultResolved)
    }),
  }

  // All builder methods return the query itself so calls can be chained.
  for (const key of [
    'select', 'insert', 'update', 'eq', 'or', 'not', 'is', 'in', 'order', 'limit', 'range',
  ]) {
    ;(query as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(query)
  }

  return {
    from: vi.fn().mockReturnValue(query),
    select: query.select,
    insert: query.insert,
    update: query.update,
    eq: query.eq,
    or: query.or,
    not: query.not,
    is: query.is,
    in: query.in,
    order: query.order,
    limit: query.limit,
    range: query.range,
    single: query.single,
    maybeSingle: query.maybeSingle,
  }
}

const ORG_ID = 'org-test'
const LEAD_ID = 'lead-test'

// ---------------------------------------------------------------------------
// logLeadContactAttemptAction
// ---------------------------------------------------------------------------

describe('logLeadContactAttemptAction', () => {
  let supabase: ReturnType<typeof makeChain>

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = makeChain()
    ;(createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
  })

  test('inserts into patient_lead_contact_log', async () => {
    // First maybeSingle: fetch lead stage+org; second: fetch contact_attempts
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { stage: 'pre_screen', organization_id: ORG_ID }, error: null })
      .mockResolvedValue({ data: { contact_attempts: 2 }, error: null })

    const result = await logLeadContactAttemptAction(LEAD_ID, {
      attempt_type: 'call',
      outcome: 'no_answer',
      notes: 'Left vm',
    })

    expect(result.ok).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('patient_lead_contact_log')
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_lead_id: LEAD_ID,
        attempt_type: 'call',
        outcome: 'no_answer',
      }),
    )
  })

  test('increments contact_attempts + sets last_contacted_at', async () => {
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { stage: 'pre_screen', organization_id: ORG_ID }, error: null })
      .mockResolvedValue({ data: { contact_attempts: 2 }, error: null })

    const result = await logLeadContactAttemptAction(LEAD_ID, {
      attempt_type: 'sms',
      outcome: 'no_answer',
    })

    expect(result.ok).toBe(true)
    // The update on patient_leads should include last_contacted_at and incremented counter
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_attempts: 3, // 2 + 1
        last_contacted_at: expect.any(String),
      }),
    )
  })

  test('outcome=reached + stage=lead → transitions to contacted', async () => {
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { stage: 'lead', organization_id: ORG_ID }, error: null })
      .mockResolvedValue({ data: { contact_attempts: 0 }, error: null })

    const result = await logLeadContactAttemptAction(LEAD_ID, {
      attempt_type: 'call',
      outcome: 'reached',
    })

    expect(result.ok).toBe(true)
    expect(recordLeadStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStage: 'lead',
        toStage: 'contacted',
      }),
    )
  })

  test('outcome=reached + stage=pre_screen → NO auto-transition', async () => {
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { stage: 'pre_screen', organization_id: ORG_ID }, error: null })
      .mockResolvedValue({ data: { contact_attempts: 1 }, error: null })

    await logLeadContactAttemptAction(LEAD_ID, {
      attempt_type: 'call',
      outcome: 'reached',
    })

    // recordLeadStageTransition should NOT have been called (no auto-transition from pre_screen)
    expect(recordLeadStageTransition).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// qualifyLeadAction
// ---------------------------------------------------------------------------

describe('qualifyLeadAction', () => {
  let supabase: ReturnType<typeof makeChain>

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = makeChain()
    ;(createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
  })

  test('stage=pre_screen → qualified, calls recordLeadStageTransition', async () => {
    supabase.maybeSingle.mockResolvedValue({
      data: { stage: 'pre_screen', organization_id: ORG_ID },
      error: null,
    })

    const result = await qualifyLeadAction(LEAD_ID)

    expect(result.ok).toBe(true)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'qualified' }),
    )
    expect(recordLeadStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStage: 'pre_screen',
        toStage: 'qualified',
      }),
    )
  })

  test("stage != pre_screen → returns { ok: false, error: 'INVALID_STAGE' }", async () => {
    supabase.maybeSingle.mockResolvedValue({
      data: { stage: 'lead', organization_id: ORG_ID },
      error: null,
    })

    const result = await qualifyLeadAction(LEAD_ID)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('INVALID_STAGE')
    }
    expect(supabase.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'qualified' }),
    )
  })
})

// ---------------------------------------------------------------------------
// assignLeadStudyAction
// ---------------------------------------------------------------------------

describe('assignLeadStudyAction', () => {
  let supabase: ReturnType<typeof makeChain>

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = makeChain()
    ;(createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
  })

  test('first match → is_primary=true', async () => {
    // 1: fetch lead org; 2: check existing match (none); 3: insert result
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { organization_id: ORG_ID }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }) // no existing match
      .mockResolvedValue({ data: { id: 'new-match-id' }, error: null }) // insert result

    const result = await assignLeadStudyAction(LEAD_ID, 'study-1', false)

    expect(result.ok).toBe(true)
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_primary: true }),
    )
  })

  test('second match for same lead → is_primary=false', async () => {
    // 1: lead org; 2: existing match present; 3: insert result
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { organization_id: ORG_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing-match', is_primary: true }, error: null })
      .mockResolvedValue({ data: { id: 'new-match-id' }, error: null })

    const result = await assignLeadStudyAction(LEAD_ID, 'study-2', false)

    expect(result.ok).toBe(true)
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_primary: false }),
    )
  })

  test('markPrimary=true → updates existing primary, inserts new one as primary', async () => {
    // 1: lead org; 2: existing match present; 3: insert result
    supabase.maybeSingle
      .mockResolvedValueOnce({ data: { organization_id: ORG_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing-match', is_primary: true }, error: null })
      .mockResolvedValue({ data: { id: 'new-match-id' }, error: null })

    const result = await assignLeadStudyAction(LEAD_ID, 'study-3', true)

    expect(result.ok).toBe(true)
    // Should have called update to clear existing primary
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_primary: false }),
    )
    // Should have inserted new match as primary
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_primary: true }),
    )
  })
})

// ---------------------------------------------------------------------------
// convertLeadToSubjectAction
// ---------------------------------------------------------------------------

describe('convertLeadToSubjectAction', () => {
  let supabase: ReturnType<typeof makeChain>

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = makeChain()
    ;(createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(linkLeadToSubject as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    // Provide org resolution for each test
    supabase.maybeSingle.mockResolvedValue({
      data: { organization_id: ORG_ID },
      error: null,
    })
  })

  test('calls linkLeadToSubject with correct studySubjectId', async () => {
    const studySubjectId = 'subject-uuid-1'

    const result = await convertLeadToSubjectAction(LEAD_ID, studySubjectId)

    expect(result.ok).toBe(true)
    expect(linkLeadToSubject).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: LEAD_ID,
        studySubjectId,
      }),
    )
  })

  test('linkLeadToSubject failure → returns { ok: false }', async () => {
    ;(linkLeadToSubject as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'Subject not found.',
    })

    const result = await convertLeadToSubjectAction(LEAD_ID, 'subject-uuid-2')

    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// scheduleLeadFollowUpAction
// ---------------------------------------------------------------------------

describe('scheduleLeadFollowUpAction', () => {
  let supabase: ReturnType<typeof makeChain>

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = makeChain()
    ;(createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    supabase.maybeSingle.mockResolvedValue({
      data: { organization_id: ORG_ID },
      error: null,
    })
  })

  test('updates next_follow_up_at with a future date', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const result = await scheduleLeadFollowUpAction(LEAD_ID, futureDate)

    expect(result.ok).toBe(true)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ next_follow_up_at: futureDate }),
    )
  })

  test('rejects past dates', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString()

    const result = await scheduleLeadFollowUpAction(LEAD_ID, pastDate)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/future/i)
    }
  })
})

