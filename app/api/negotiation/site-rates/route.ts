import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'

const SiteRatesSchema = z.object({
  pi_hourly_salary: z.number().positive(),
  crc_hourly_salary: z.number().positive(),
  rn_hourly_salary: z.number().positive(),
  benefits_pct: z.number().min(0).max(200),
  overhead_pct: z.number().min(0).max(500),
  margin_pct: z.number().min(0).max(200),
  billable_time_pct: z.number().min(0).max(100),
  inflation_pct: z.number().min(0).max(50),
  profile_name: z.string().min(1).max(100).optional(),
})

async function getOrgId(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return null
  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  return memberships[0]?.organization_id ?? null
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ profile: null })

  const { data } = await supabase
    .from('site_rate_profiles')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()

  return NextResponse.json({ profile: data ?? null })
}

export async function PUT(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: 'No organization found' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = SiteRatesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad Request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { profile_name, ...rates } = parsed.data

  const { data: existing } = await supabase
    .from('site_rate_profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()

  let result
  if (existing?.id) {
    result = await supabase
      .from('site_rate_profiles')
      .update({ ...rates, profile_name: profile_name ?? 'Default', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('site_rate_profiles')
      .insert({ ...rates, profile_name: profile_name ?? 'Default', organization_id: orgId, is_default: true })
      .select()
      .single()
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: result.data })
}
