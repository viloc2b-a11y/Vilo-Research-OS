/**
 * Staging/dev — seed RBAC + blinding QA users and test operational_events.
 *
 * Usage:
 *   npm run db:seed-rbac-blinding-qa
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

const DEFAULT_STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const QA_PASSWORD = 'RbacBlindingQa!2026'

/** Single-role personas (legacy role column + roles[] mirror). */
const QA_USERS_SINGLE = [
  {
    email: 'rbac.qa.research_coordinator@vilo-os.staging',
    displayName: 'RBAC QA Research Coordinator',
    role: 'research_coordinator',
  },
  {
    email: 'rbac.qa.data_coordinator@vilo-os.staging',
    displayName: 'RBAC QA Data Coordinator',
    role: 'data_coordinator',
  },
  {
    email: 'rbac.qa.unblinded.coordinator@vilo-os.staging',
    displayName: 'RBAC QA Unblinded Coordinator',
    role: 'unblinded_coordinator',
  },
  {
    email: 'rbac.qa.unblinded.cra@vilo-os.staging',
    displayName: 'RBAC QA Unblinded CRA',
    role: 'unblinded_cra',
  },
  {
    email: 'rbac.qa.read_only@vilo-os.staging',
    displayName: 'RBAC QA Read Only',
    role: 'read_only',
  },
]

/** Multi-role union QA (roles[] is source of truth; role = primary for RLS). */
const QA_USERS_MULTI = [
  {
    email: 'rbac.qa.rc_plus_data@vilo-os.staging',
    displayName: 'RBAC QA RC + Data Coordinator',
    role: 'research_coordinator',
    roles: ['research_coordinator', 'data_coordinator'],
  },
  {
    email: 'rbac.qa.unblinded_plus_data@vilo-os.staging',
    displayName: 'RBAC QA Unblinded + Data Coordinator',
    role: 'unblinded_coordinator',
    roles: ['unblinded_coordinator', 'data_coordinator'],
  },
]

const TEST_EVENTS = [
  {
    marker: 'QA-RBAC-BLINDED',
    blinding_scope: 'blinded',
    title: 'QA RBAC blinded manual event',
  },
  {
    marker: 'QA-RBAC-UNBLINDED',
    blinding_scope: 'unblinded',
    title: 'QA RBAC unblinded manual event',
    unblinded_notes: 'IP kit assignment reference (QA only)',
  },
  {
    marker: 'QA-RBAC-PUBLIC',
    blinding_scope: 'public_to_site',
    title: 'QA RBAC public_to_site manual event',
  },
]

function assertStagingTarget(org) {
  if (process.env.CALENDAR_SEED_ALLOW_ANY_ORG === 'true') return
  const name = org?.name ?? ''
  if (!/staging/i.test(name) && !/synthetic/i.test(name) && !/phase\s*2/i.test(name)) {
    throw new Error(`Refusing to seed non-staging org: ${name}`)
  }
}

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

async function ensureUser(admin, spec) {
  const existing = await findUserByEmail(admin, spec.email)
  if (existing) {
    console.log(`  User exists: ${spec.email} (${existing.id})`)
    return existing
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: QA_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: spec.displayName },
  })
  if (error) throw new Error(`createUser ${spec.email}: ${error.message}`)
  console.log(`  Created user: ${spec.email} (${data.user.id})`)
  return data.user
}

async function upsertMembership(admin, orgId, userId, spec) {
  const roles = spec.roles ?? [spec.role]
  const row = {
    organization_id: orgId,
    user_id: userId,
    role: spec.role,
    roles,
  }
  const { error } = await admin.from('organization_members').upsert(row, {
    onConflict: 'organization_id,user_id',
  })
  if (error) throw new Error(`membership ${spec.email}: ${error.message}`)
}

async function resolveOrganization(admin) {
  const orgId = process.env.CALENDAR_QA_ORG_ID?.trim()
  if (orgId) {
    const { data, error } = await admin.from('organizations').select('id, name').eq('id', orgId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error(`Org not found: ${orgId}`)
    return data
  }
  const studyId = (process.env.CALENDAR_QA_STUDY_ID ?? DEFAULT_STUDY_ID).trim()
  const { data: study, error } = await admin
    .from('studies')
    .select('organization_id, organizations(id, name)')
    .eq('id', studyId)
    .maybeSingle()
  if (error) throw error
  const org = study?.organizations
  if (org && typeof org === 'object' && !Array.isArray(org)) return { id: org.id, name: org.name }
  const { data, error: orgErr } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', study.organization_id)
    .maybeSingle()
  if (orgErr) throw orgErr
  return data
}

async function main() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const org = await resolveOrganization(admin)
  assertStagingTarget(org)
  console.log(`Organization: ${org.name} (${org.id})`)

  const studyId = (process.env.CALENDAR_QA_STUDY_ID ?? DEFAULT_STUDY_ID).trim()
  const { data: study, error: studyErr } = await admin
    .from('studies')
    .select('id')
    .eq('id', studyId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (studyErr || !study) throw new Error(`Study ${studyId} not in org`)

  const seededUsers = []
  const allSpecs = [...QA_USERS_SINGLE, ...QA_USERS_MULTI]
  for (const spec of allSpecs) {
    const user = await ensureUser(admin, spec)
    await admin.from('profiles').upsert({ id: user.id, display_name: spec.displayName })
    await upsertMembership(admin, org.id, user.id, spec)
    const rolesLabel = (spec.roles ?? [spec.role]).join(' + ')
    console.log(`  Membership: ${spec.email} → ${rolesLabel}`)
    seededUsers.push({ ...spec, id: user.id, roles: spec.roles ?? [spec.role] })
  }

  const legacyEmail = 'calendar.qa.coordinator@vilo-os.staging'
  const legacyUser = await findUserByEmail(admin, legacyEmail)
  if (legacyUser) {
    await admin.from('organization_members').upsert(
      {
        organization_id: org.id,
        user_id: legacyUser.id,
        role: 'research_coordinator',
        roles: ['research_coordinator'],
      },
      { onConflict: 'organization_id,user_id' },
    )
    console.log(`  Updated ${legacyEmail} → research_coordinator`)
  }

  const { data: existingEvents } = await admin
    .from('operational_events')
    .select('id, payload')
    .eq('organization_id', org.id)
    .eq('event_type', 'OPERATIONAL_CALENDAR_MANUAL_EVENT')
    .limit(500)

  const markers = new Set(TEST_EVENTS.map((e) => e.marker))
  const toDelete = (existingEvents ?? [])
    .filter((row) => {
      const title = row.payload?.title
      const marker = row.payload?.qa_marker
      return (
        (typeof title === 'string' && title.startsWith('QA RBAC'))
        || (typeof marker === 'string' && markers.has(marker))
      )
    })
    .map((row) => row.id)

  if (toDelete.length > 0) {
    await admin.from('operational_events').delete().in('id', toDelete)
    console.log(`  Removed ${toDelete.length} prior QA RBAC test events`)
  }

  const eventDate = '2026-06-10'
  const insertedEvents = []
  for (const spec of TEST_EVENTS) {
    const { data, error } = await admin
      .from('operational_events')
      .insert({
        organization_id: org.id,
        study_id: studyId,
        event_type: 'OPERATIONAL_CALENDAR_MANUAL_EVENT',
        actor_user_id: seededUsers[0]?.id,
        occurred_at: `${eventDate}T12:00:00.000Z`,
        payload: {
          calendar_event_type: 'manual',
          blinding_scope: spec.blinding_scope,
          qa_marker: spec.marker,
          title: spec.title,
          event_date: eventDate,
          event_time: '12:00',
          manual_event_type: 'other',
          notes: spec.unblinded_notes ?? 'RBAC blinding QA seed',
          source: 'rbac_blinding_qa_seed',
        },
      })
      .select('id, payload')
      .single()
    if (error) throw new Error(`insert event ${spec.marker}: ${error.message}`)
    insertedEvents.push({ id: data.id, scope: spec.blinding_scope, marker: spec.marker })
  }

  console.log('\n--- RBAC blinding QA seed complete ---')
  console.log(
    JSON.stringify(
      {
        organization: org,
        studyId,
        password: QA_PASSWORD,
        seededUsers,
        testEvents: insertedEvents,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
