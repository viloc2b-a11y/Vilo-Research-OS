/**
 * Validates DB RLS helpers respect organization_members.status.
 *
 * Usage: node scripts/validate-active-membership-rls.mjs
 *
 * Requires .env.local with Supabase URL, anon key, service role key.
 */
import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { serializeCookieHeader } from '@supabase/ssr'
import { loadEnvFiles } from './lib/env.mjs'
import { SYNTHETIC } from './lib/source-api-e2e.mjs'

loadEnvFiles()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !serviceKey) throw new Error('Missing Supabase env')

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const QA_EMAIL = process.env.CALENDAR_QA_COORDINATOR_EMAIL ?? 'calendar.qa.coordinator@vilo-os.staging'
const QA_PASSWORD = process.env.CALENDAR_QA_COORDINATOR_PASSWORD ?? 'CalendarQaCoordinator!2026'
const ORG_ID = process.env.TEST_ORG_ID ?? 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'

async function signIn(email, password) {
  const jar = []
  const supabase = createBrowserClient(url, anon, {
    isSingleton: false,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    cookies: {
      getAll: () => [...jar],
      setAll: (items) => {
        jar.length = 0
        jar.push(...items)
      },
    },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(error?.message ?? `sign-in failed: ${email}`)
  const client = createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, userId: data.session.user.id }
}

async function setMembershipStatus(userId, status) {
  const { error } = await admin
    .from('organization_members')
    .update(
      status === 'active'
        ? {
            status: 'active',
            deactivated_at: null,
            deactivated_by: null,
            deactivation_reason: null,
          }
        : { status: 'deactivated', deactivated_at: new Date().toISOString() },
    )
    .eq('organization_id', ORG_ID)
    .eq('user_id', userId)
  if (error) throw error
}

async function probeRls(client, label) {
  const orgs = await client.from('organizations').select('id').limit(5)
  const studies = await client.from('studies').select('id').limit(5)
  const members = await client
    .from('organization_members')
    .select('id, status')
    .eq('organization_id', ORG_ID)
    .limit(5)

  const { data: isAdmin, error: adminErr } = await client.rpc('user_is_org_admin', {
    _organization_id: ORG_ID,
  })

  return {
    label,
    orgCount: orgs.data?.length ?? 0,
    studyCount: studies.data?.length ?? 0,
    memberCount: members.data?.length ?? 0,
    isOrgAdmin: Boolean(isAdmin),
    errors: [orgs.error, studies.error, members.error, adminErr].filter(Boolean).map((e) => e.message),
  }
}

function assertBlocked(result) {
  if (result.orgCount > 0 || result.studyCount > 0 || result.isOrgAdmin) {
    throw new Error(
      `${result.label}: expected RLS block, got orgs=${result.orgCount} studies=${result.studyCount} admin=${result.isOrgAdmin}`,
    )
  }
}

function assertAllowed(result, { minStudies = 0 } = {}) {
  if (result.errors.length > 0) {
    throw new Error(`${result.label}: errors ${result.errors.join('; ')}`)
  }
  if (result.orgCount === 0) {
    throw new Error(`${result.label}: expected org visibility`)
  }
  if (minStudies > 0 && result.studyCount < minStudies) {
    throw new Error(`${result.label}: expected studies visible`)
  }
}

console.log('validate-active-membership-rls: starting')

const { data: qaUsers } = await admin.auth.admin.listUsers({ perPage: 200 })
const qaUser = qaUsers?.users?.find((u) => u.email?.toLowerCase() === QA_EMAIL.toLowerCase())
if (!qaUser?.id) throw new Error(`QA user not found: ${QA_EMAIL}`)

await setMembershipStatus(qaUser.id, 'active')
const qaActive = await signIn(QA_EMAIL, QA_PASSWORD)
const activeProbe = await probeRls(qaActive.client, 'qa-active')
assertAllowed(activeProbe)

await setMembershipStatus(qaUser.id, 'deactivated')
const qaDeactivated = await signIn(QA_EMAIL, QA_PASSWORD)
const deactivatedProbe = await probeRls(qaDeactivated.client, 'qa-deactivated')
assertBlocked(deactivatedProbe)

await setMembershipStatus(qaUser.id, 'active')

const adminUser = await signIn(SYNTHETIC.userA.email, SYNTHETIC.userA.password)
const adminProbe = await probeRls(adminUser.client, 'admin-active')
if (!adminProbe.isOrgAdmin) throw new Error('admin-active: expected user_is_org_admin true')
assertAllowed(adminProbe, { minStudies: 1 })

const { data: deactivatedMembers, error: listErr } = await admin
  .from('organization_members')
  .select('id, user_id, status')
  .eq('organization_id', ORG_ID)
  .eq('status', 'deactivated')
  .limit(3)
if (listErr) throw listErr
console.log(
  `  historical: ${deactivatedMembers?.length ?? 0} deactivated row(s) still in DB (service role)`,
)

console.log('validate-active-membership-rls: PASS')
