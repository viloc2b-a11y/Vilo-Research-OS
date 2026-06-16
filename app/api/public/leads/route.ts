import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { IntakeLeadSchema, intakeLead } from '@/lib/crm/intake-lead'

/**
 * POST /api/public/leads
 *
 * Public unauthenticated lead intake endpoint. Validates the request body
 * against IntakeLeadSchema, resolves the organization by UUID, deduplicates
 * by normalized phone, scores the lead, and persists a patient_leads row.
 *
 * Uses the service-role client (createServiceClient) — ADR-2 Option B.
 * The patient_leads RLS policies only allow authenticated users; anon INSERT
 * is not permitted. The service-role client bypasses RLS, which is acceptable
 * here because all validation and org-scoping happens in intakeLead().
 *
 * Security note: rate limiting is deferred to a later hardening phase.
 * This absence MUST be noted in the PR description.
 *
 * Response contract: { lead_id, tier, duplicate } only — no PII returned.
 */
export async function POST(req: Request) {
  try {
    // 1. Parse JSON body — treat malformed JSON as a validation error
    const body = await req.json().catch(() => null)

    // 2. Validate against schema
    const parsed = IntakeLeadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: parsed.error.issues.map((i) => i.message).join('; '),
        },
        { status: 400 },
      )
    }

    // 3. Create service-role Supabase client (server-only — key never exposed to client)
    const supabase = await createServiceClient()

    // 4. Delegate all business logic to intakeLead — never throws
    const result = await intakeLead(supabase, parsed.data)

    // 5. Map discriminated union → HTTP response
    if (!result.ok) {
      if (result.error === 'ORG_NOT_FOUND') {
        return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
      }
      // INTAKE_FAILED or VALIDATION_ERROR from business logic
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // 6. Success — return only the stable public contract (no PII)
    return NextResponse.json({
      lead_id: result.lead_id,
      tier: result.tier,
      duplicate: result.duplicate,
    })
  } catch {
    // Last-resort catch — mirrors the existing chargemaster route pattern
    return NextResponse.json({ error: 'INTAKE_FAILED' }, { status: 500 })
  }
}
