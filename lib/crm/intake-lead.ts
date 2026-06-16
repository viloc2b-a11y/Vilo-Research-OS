import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateLeadScore } from '@/lib/crm/calculate-lead-score'
import type { LeadTier } from '@/lib/crm/calculate-lead-score'

// ---------------------------------------------------------------------------
// Zod schema — LOCKED DECISION: organization_id UUID in request body
// Note: patient_leads.full_name is NOT NULL, so we accept first_name (required)
//       and last_name (optional) and join them on insert.
// ---------------------------------------------------------------------------

export const IntakeLeadSchema = z.object({
  organization_id: z.string().uuid(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  sms_opt_in: z.boolean(),
  // Scoring signals
  symptom_match: z.boolean(),
  duration_meets_threshold: z.boolean(),
  age: z.number().int().min(0).max(120),
  within_service_area: z.boolean(),
  diagnosis_confirmed: z.boolean(),
  availability_confirmed: z.boolean(),
  // Score config overrides
  min_age: z.number().int().optional(),
  max_age: z.number().int().optional(),
  // Attribution
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  ref_code: z.string().optional(),
  // Study context (informational — no condition_slug column on patient_leads)
  condition_slug: z.string().optional(),
})

export type IntakeLeadPayload = z.infer<typeof IntakeLeadSchema>

// ---------------------------------------------------------------------------
// Discriminated union result — intakeLead never throws
// ---------------------------------------------------------------------------

export type IntakeResult =
  | { ok: true; lead_id: string; tier: LeadTier; duplicate: boolean }
  | { ok: false; error: 'ORG_NOT_FOUND' | 'VALIDATION_ERROR' | 'INTAKE_FAILED'; details?: string }

// ---------------------------------------------------------------------------
// Attribution fields type
// ---------------------------------------------------------------------------

type AttributionFields = {
  refCode?: string
  refResolved?: boolean
  utmCampaignResolved?: boolean
  utmSource?: string
  utmMedium?: string
}

// ---------------------------------------------------------------------------
// Exported pure helpers (also used in tests)
// ---------------------------------------------------------------------------

/** Strip non-digits. Strip leading US country code from 11-digit numbers. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/** Re-derive tier from a stored prescreen_score (used for duplicates). */
export function deriveTier(score: number | null): LeadTier {
  if (score === null) return 'waitlist'
  return score >= 16 ? 'high' : score >= 10 ? 'medium' : 'waitlist'
}

/**
 * Derive recruitment_source_channel from attribution signals.
 * Precedence rules applied in order — first match wins.
 */
export function deriveSourceChannel(attrs: AttributionFields): string {
  if (attrs.refCode && attrs.refResolved) return 'referral_partner'
  if (attrs.refCode && !attrs.refResolved) return 'shared'
  if (attrs.utmCampaignResolved) return 'campaign'
  if (
    attrs.utmSource === 'organic' ||
    attrs.utmSource === 'seo' ||
    attrs.utmMedium === 'organic'
  )
    return 'organic_seo'
  if (attrs.utmSource === 'community') return 'community'
  if (attrs.utmSource === 'social' || attrs.utmMedium === 'social') return 'shared'
  if (attrs.utmSource || attrs.utmMedium) return 'unknown'
  return 'direct'
}

// ---------------------------------------------------------------------------
// Internal async helpers — each helper receives the Supabase client so that
// tests can inject a mock (ADR-6: client injection pattern).
// ---------------------------------------------------------------------------

/**
 * Confirm the organization exists by UUID.
 * LOCKED DECISION: organization_id comes directly from the payload; no site_token.
 */
async function findOrgById(
  supabase: SupabaseClient,
  orgId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .single()
  if (error || !data) return false
  return true
}

/**
 * Find an active lead for the same org + normalized phone.
 * Dedup scope: stage NOT IN ('closed', 'randomized').
 */
async function findActiveLead(
  supabase: SupabaseClient,
  orgId: string,
  normalizedPhone: string,
): Promise<{ id: string; prescreen_score: number | null } | null> {
  const { data, error } = await supabase
    .from('patient_leads')
    .select('id, prescreen_score')
    .eq('organization_id', orgId)
    .eq('phone', normalizedPhone)
    .not('stage', 'in', '("closed","randomized")')
    .limit(1)
    .single()
  if (error || !data) return null
  return data as { id: string; prescreen_score: number | null }
}

/**
 * Resolve an active campaign by utm_campaign value scoped to the org.
 * Returns campaign UUID or null — never errors.
 */
async function resolveCampaign(
  supabase: SupabaseClient,
  orgId: string,
  utmCampaign?: string,
): Promise<string | null> {
  if (!utmCampaign) return null
  try {
    const { data, error } = await supabase
      .from('recruitment_campaigns')
      .select('id')
      .eq('utm_campaign', utmCampaign)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .limit(1)
      .single()
    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

/**
 * Resolve a referral relationship by ref_code.
 *
 * APPLY-TIME FINDING: Migration 0166 inspected — contact_referral_relationships has NO
 * referral code column (no referral_code, code, partner_code, or source_code column).
 * Per ADR-7, this is a graceful degrade: always return null.
 * Logged as Phase 5 design gap: referral code lookup deferred.
 */
async function resolveReferral(
  _supabase: SupabaseClient,
  _orgId: string,
  _refCode?: string,
): Promise<string | null> {
  // Phase 5 gap: contact_referral_relationships has no referral code column.
  // Graceful degrade per ADR-7 — attribution detail is lost, never the lead.
  return null
}

/**
 * Insert one patient_leads row. Returns the new lead's UUID.
 * Uses exact column names from migration 0164:
 * - full_name (NOT NULL) — constructed from first_name + last_name
 * - phone (nullable text)
 * - stage defaults to 'lead' in DB (still explicit for clarity)
 * - condition_slug: no column on patient_leads — omitted
 */
async function insertLead(
  supabase: SupabaseClient,
  data: {
    organization_id: string
    full_name: string
    phone: string
    email?: string
    sms_opt_in: boolean
    prescreen_score: number
    recruitment_source_channel: string
    referral_relationship_id: string | null
    campaign_id: string | null
    contact_attempts: number
    stage: string
  },
): Promise<string> {
  const { data: inserted, error } = await supabase
    .from('patient_leads')
    .insert(data)

  if (error) throw new Error(`Insert failed: ${error.message}`)

  // Supabase insert with select returns data[] on success
  const rows = inserted as Array<{ id: string }> | null
  if (!rows || rows.length === 0) throw new Error('Insert returned no rows')
  return rows[0].id
}

// ---------------------------------------------------------------------------
// Main orchestrator — never throws; returns IntakeResult discriminated union
// ---------------------------------------------------------------------------

export async function intakeLead(
  supabase: SupabaseClient,
  payload: IntakeLeadPayload,
): Promise<IntakeResult> {
  try {
    // 1. Validate org
    const orgExists = await findOrgById(supabase, payload.organization_id)
    if (!orgExists) return { ok: false, error: 'ORG_NOT_FOUND' }

    // 2. Normalize phone
    const normalizedPhone = normalizePhone(payload.phone)

    // 3. Dedup check — return existing lead if active match found
    const existing = await findActiveLead(supabase, payload.organization_id, normalizedPhone)
    if (existing) {
      return {
        ok: true,
        lead_id: existing.id,
        tier: deriveTier(existing.prescreen_score),
        duplicate: true,
      }
    }

    // 4. Resolve campaign (null on no match — never errors)
    const campaignId = await resolveCampaign(supabase, payload.organization_id, payload.utm_campaign)

    // 5. Resolve referral (always null — Phase 5 gap, no code column exists)
    const referralId = await resolveReferral(supabase, payload.organization_id, payload.ref_code)

    // 6. Derive source channel from attribution signals
    const sourceChannel = deriveSourceChannel({
      refCode: payload.ref_code,
      refResolved: !!referralId,
      utmCampaignResolved: !!campaignId,
      utmSource: payload.utm_source,
      utmMedium: payload.utm_medium,
    })

    // 7. Score the lead — hard-fail produces score 0, tier 'waitlist'; lead is still inserted
    const scoreResult = calculateLeadScore(
      {
        symptomMatch: payload.symptom_match,
        durationMeetsThreshold: payload.duration_meets_threshold,
        age: payload.age,
        withinServiceArea: payload.within_service_area,
        diagnosisConfirmed: payload.diagnosis_confirmed,
        availabilityConfirmed: payload.availability_confirmed,
      },
      {
        minAge: payload.min_age ?? 18,
        maxAge: payload.max_age ?? 80,
      },
    )

    // 8. Construct full_name for the NOT NULL column (first_name is required; last_name is optional)
    const fullName = payload.last_name
      ? `${payload.first_name} ${payload.last_name}`
      : payload.first_name

    // 9. Insert — even hard-fail leads are captured (ADR-9)
    const leadId = await insertLead(supabase, {
      organization_id: payload.organization_id,
      full_name: fullName,
      phone: normalizedPhone,
      email: payload.email,
      sms_opt_in: payload.sms_opt_in,
      prescreen_score: scoreResult.score,
      recruitment_source_channel: sourceChannel,
      referral_relationship_id: referralId,
      campaign_id: campaignId,
      contact_attempts: 0,
      stage: 'lead',
    })

    return { ok: true, lead_id: leadId, tier: scoreResult.tier, duplicate: false }
  } catch {
    return { ok: false, error: 'INTAKE_FAILED' }
  }
}
