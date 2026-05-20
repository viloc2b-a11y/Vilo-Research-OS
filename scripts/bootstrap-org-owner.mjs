/**
 * Bootstrap org owner/admin for internal production setup (service role).
 *
 * Updates only public.organization_members (+ profiles display name if missing).
 * Does not change auth providers, RLS, or application role checks.
 *
 * Usage:
 *   npm run db:bootstrap-org-owner
 *
 * Env (optional):
 *   BOOTSTRAP_ORG_OWNER_EMAIL   default: jmendez@viloresearchgroup.com
 *   BOOTSTRAP_ORG_OWNER_ROLE      default: owner  (owner | admin)
 *   BOOTSTRAP_ORG_ID              uuid — preferred when known
 *   BOOTSTRAP_ORG_NAME            organization name match (ilike)
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

const DEFAULT_EMAIL = 'jmendez@viloresearchgroup.com'
const DEFAULT_ROLE = 'owner'
const ALLOWED_ROLES = new Set(['owner', 'admin'])

async function findUserByEmail(admin, email) {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 200

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const match = data?.users?.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match
    if (!data?.users?.length || data.users.length < perPage) break
    page += 1
  }

  return null
}

async function resolveOrganization(admin) {
  const orgId = process.env.BOOTSTRAP_ORG_ID?.trim()
  if (orgId) {
    const { data, error } = await admin
      .from('organizations')
      .select('id, name, created_at')
      .eq('id', orgId)
      .maybeSingle()
    if (error) throw new Error(`organization by id: ${error.message}`)
    if (!data) throw new Error(`Organization not found for BOOTSTRAP_ORG_ID=${orgId}`)
    return data
  }

  const orgName = process.env.BOOTSTRAP_ORG_NAME?.trim()
  if (orgName) {
    const { data, error } = await admin
      .from('organizations')
      .select('id, name, created_at')
      .ilike('name', orgName)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`organization by name: ${error.message}`)
    if (!data) throw new Error(`Organization not found matching BOOTSTRAP_ORG_NAME=${orgName}`)
    return data
  }

  const { data, error } = await admin
    .from('organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`organizations list: ${error.message}`)
  if (!data?.length) {
    throw new Error('No organizations exist. Create one in Supabase before bootstrapping.')
  }

  const nonSynthetic = data.filter((org) => !/synthetic/i.test(org.name))
  const chosen = nonSynthetic[0] ?? data[0]

  if (data.length > 1) {
    console.warn(
      'Multiple organizations found; set BOOTSTRAP_ORG_ID or BOOTSTRAP_ORG_NAME to be explicit.',
    )
    for (const org of data) console.warn(`  - ${org.name} (${org.id})`)
    console.warn(`Using: ${chosen.name} (${chosen.id})`)
  }

  return chosen
}

async function main() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()

  const email = (process.env.BOOTSTRAP_ORG_OWNER_EMAIL ?? DEFAULT_EMAIL).trim()
  const role = (process.env.BOOTSTRAP_ORG_OWNER_ROLE ?? DEFAULT_ROLE).trim()
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(`BOOTSTRAP_ORG_OWNER_ROLE must be owner or admin (got "${role}")`)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log(`Resolving auth user: ${email}`)
  const user = await findUserByEmail(admin, email)
  if (!user) {
    throw new Error(
      `Auth user not found for ${email}. Sign up or invite the user in Supabase Auth first.`,
    )
  }

  console.log(`Resolving primary organization...`)
  const org = await resolveOrganization(admin)

  const { data: before } = await admin
    .from('organization_members')
    .select('id, role, created_at')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  await admin.from('profiles').upsert({
    id: user.id,
    display_name: user.user_metadata?.display_name ?? email.split('@')[0],
  })

  const { data: membership, error: memErr } = await admin
    .from('organization_members')
    .upsert(
      {
        organization_id: org.id,
        user_id: user.id,
        role,
      },
      { onConflict: 'organization_id,user_id' },
    )
    .select('id, organization_id, user_id, role, created_at')
    .single()

  if (memErr) throw new Error(`organization_members upsert: ${memErr.message}`)

  const summary = {
    table: 'public.organization_members',
    organization: { id: org.id, name: org.name },
    user: { id: user.id, email: user.email },
    previousRole: before?.role ?? null,
    resultingRole: membership.role,
    membershipId: membership.id,
    newStudyEnabled: role === 'owner' || role === 'admin',
  }

  console.log('\n--- Bootstrap complete ---')
  console.log(JSON.stringify(summary, null, 2))
  console.log(
    '\nSign in as this user and open /studies — New Study is enabled for organization owner/admin roles.',
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
