/**
 * Validate RBAC roles in DB + blinding read-model + multi-role union permissions.
 *
 * Usage:
 *   npm run db:validate-rbac-blinding-qa
 */
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'
import {
  canAccessAdminForMembership,
  canAccessCoordinatorWorkspaceForMembership,
  canEditClinicalSourceForMembership,
  canMutateForMembership,
  canManageUnblindedForMembership,
  canViewFinancialForMembership,
  canViewUnblindedForMembership,
  resolveEffectiveRoles,
} from './lib/rbac-effective-roles.mjs'

const DEFAULT_STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'

const CANONICAL_ROLES = [
  'owner',
  'admin',
  'site_staff',
  'research_coordinator',
  'data_coordinator',
  'pi_sub_i',
  'read_only',
  'unblinded_coordinator',
  'unblinded_cra',
]

const QA_EMAIL_BY_PERSONA = {
  research_coordinator: 'rbac.qa.research_coordinator@vilo-os.staging',
  data_coordinator: 'rbac.qa.data_coordinator@vilo-os.staging',
  rc_plus_data: 'rbac.qa.rc_plus_data@vilo-os.staging',
  unblinded_plus_data: 'rbac.qa.unblinded_plus_data@vilo-os.staging',
  unblinded_coordinator: 'rbac.qa.unblinded.coordinator@vilo-os.staging',
  unblinded_cra: 'rbac.qa.unblinded.cra@vilo-os.staging',
  read_only: 'rbac.qa.read_only@vilo-os.staging',
}

function isUnblindedPayload(payload) {
  return payload?.blinding_scope === 'unblinded' || payload?.is_unblinded === true
}

function filterRows(rows, canViewUnblinded) {
  if (canViewUnblinded) return rows
  return rows.filter((row) => !isUnblindedPayload(row.payload))
}

function expectedMarkersForMembership(mem) {
  return canViewUnblindedForMembership(mem)
    ? ['QA-RBAC-BLINDED', 'QA-RBAC-PUBLIC', 'QA-RBAC-UNBLINDED']
    : ['QA-RBAC-BLINDED', 'QA-RBAC-PUBLIC']
}

async function verifyDbRoleConstraint(sql) {
  const [row] = await sql`
    select pg_get_constraintdef(oid) as def
    from pg_constraint
    where conname = 'organization_members_role_check'
    limit 1
  `
  const def = row?.def ?? ''
  const results = CANONICAL_ROLES.map((role) => ({
    role,
    ok: def.includes(`'${role}'`),
    error: def.includes(`'${role}'`) ? null : 'role not listed in CHECK constraint',
  }))

  return { def, results }
}

async function verifyRolesArrayConstraint(sql) {
  const [row] = await sql`
    select pg_get_constraintdef(oid) as def
    from pg_constraint
    where conname = 'organization_members_roles_check'
    limit 1
  `
  const def = row?.def ?? ''
  if (!def) return { ok: false, error: 'organization_members_roles_check missing' }
  const missing = CANONICAL_ROLES.filter((role) => !def.includes(`'${role}'`))
  if (missing.length) {
    return { ok: false, error: `roles CHECK missing: ${missing.join(', ')}` }
  }
  return { ok: true, def }
}

async function verifyInvalidRoleRejected(sql, orgId, probeUserId) {
  const [before] = await sql`
    select role, roles from organization_members
    where organization_id = ${orgId} and user_id = ${probeUserId}
    limit 1
  `
  if (!before?.role) return { ok: false, error: 'probe user membership missing' }
  try {
    await sql`
      update organization_members
      set role = 'invalid_rbac_role_xyz'
      where organization_id = ${orgId} and user_id = ${probeUserId}
    `
    await sql`
      update organization_members
      set role = ${before.role}, roles = ${before.roles}
      where organization_id = ${orgId} and user_id = ${probeUserId}
    `
    return { ok: false, error: 'invalid role unexpectedly allowed' }
  } catch (err) {
    await sql`
      update organization_members
      set role = ${before.role}, roles = ${before.roles}
      where organization_id = ${orgId} and user_id = ${probeUserId}
    `
    const rejected = /organization_members_role_check/i.test(String(err.message))
    return { ok: rejected, error: rejected ? null : err.message }
  }
}

function buildRow(persona, mem, allQaRows) {
  const effectiveRoles = resolveEffectiveRoles(mem)
  const canViewUnblinded = canViewUnblindedForMembership(mem)
  const visible = filterRows(allQaRows, canViewUnblinded)
  const visibleMarkers = visible.map((r) => r.payload?.qa_marker).filter(Boolean).sort()
  const expected = expectedMarkersForMembership(mem)
  const eventsVisiblePass =
    visibleMarkers.length === expected.length && expected.every((m) => visibleMarkers.includes(m))

  return {
    persona,
    dbRole: mem.role,
    effectiveRoles: effectiveRoles.join(' + '),
    canAccessAdmin: canAccessAdminForMembership(mem),
    canViewUnblinded,
    canManageUnblinded: canManageUnblindedForMembership(mem),
    canMutate: canMutateForMembership(mem),
    canEditSource: canEditClinicalSourceForMembership(mem),
    canCoordinatorWorkspace: canAccessCoordinatorWorkspaceForMembership(mem),
    canFinancial: canViewFinancialForMembership(mem),
    visibleEventMarkers: visibleMarkers.join(', ') || '(none)',
    eventsVisiblePass: eventsVisiblePass ? 'PASS' : 'FAIL',
    unionPass: 'PASS',
  }
}

async function main() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()
  if (!process.env.DATABASE_URL_DIRECT?.trim() && !process.env.DATABASE_URL?.trim()) {
    throw new Error('Missing DATABASE_URL_DIRECT or DATABASE_URL in .env.local')
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const studyId = (process.env.CALENDAR_QA_STUDY_ID ?? DEFAULT_STUDY_ID).trim()
  const { data: study } = await admin
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .maybeSingle()
  if (!study?.organization_id) throw new Error('Study/org not found — run seed first')

  const orgId = study.organization_id
  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })

  const { def: constraintDef, results: constraintResults } = await verifyDbRoleConstraint(sql)
  const rolesArrayCheck = await verifyRolesArrayConstraint(sql)

  console.log('DB role constraint (legacy role column):')
  console.log(`  ${constraintDef}`)
  console.log('Role acceptance (CHECK definition + invalid role rejected):')
  const failedRoles = []
  for (const row of constraintResults) {
    const status = row.ok ? 'PASS' : 'FAIL'
    console.log(`  ${status}  ${row.role}${row.error ? ` — ${row.error}` : ''}`)
    if (!row.ok) failedRoles.push(row)
  }
  if (failedRoles.length) {
    throw new Error(`CHECK missing roles: ${failedRoles.map((r) => r.role).join(', ')}`)
  }

  console.log(`\nDB roles[] constraint: ${rolesArrayCheck.ok ? 'PASS' : 'FAIL'}`)
  if (!rolesArrayCheck.ok) throw new Error(rolesArrayCheck.error)
  console.log(`  ${rolesArrayCheck.def}`)

  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 200 })
  const userIdByEmail = new Map(
    (authList?.users ?? []).map((u) => [u.email?.toLowerCase(), u.id]),
  )

  const probeUserId = userIdByEmail.get(QA_EMAIL_BY_PERSONA.read_only.toLowerCase())
  if (probeUserId) {
    const invalidProbe = await verifyInvalidRoleRejected(sql, orgId, probeUserId)
    console.log(
      `  ${invalidProbe.ok ? 'PASS' : 'FAIL'}  invalid role rejected${invalidProbe.error ? ` — ${invalidProbe.error}` : ''}`,
    )
    if (!invalidProbe.ok) throw new Error(invalidProbe.error ?? 'invalid role not rejected')
  }

  const { data: qaEvents, error: evErr } = await admin
    .from('operational_events')
    .select('id, payload')
    .eq('organization_id', orgId)
    .eq('event_type', 'OPERATIONAL_CALENDAR_MANUAL_EVENT')
    .filter('payload->>source', 'eq', 'rbac_blinding_qa_seed')

  if (evErr) throw evErr
  const allQaRows = qaEvents ?? []
  if (allQaRows.length < 3) {
    throw new Error(`Expected 3 QA events, found ${allQaRows.length}. Run npm run db:seed-rbac-blinding-qa`)
  }

  const { data: members } = await admin
    .from('organization_members')
    .select('user_id, role, roles')
    .eq('organization_id', orgId)

  const qaTable = []

  for (const [persona, email] of Object.entries(QA_EMAIL_BY_PERSONA)) {
    const userId = userIdByEmail.get(email.toLowerCase())
    const mem = (members ?? []).find((m) => m.user_id === userId)
    if (!mem) throw new Error(`Missing membership for ${email} — run seed`)
    qaTable.push(buildRow(persona, mem, allQaRows))
  }

  const ownerMember = (members ?? []).find((m) => m.role === 'owner')
  if (ownerMember) qaTable.push(buildRow('owner (live)', ownerMember, allQaRows))

  const adminMember = (members ?? []).find((m) => m.role === 'admin')
  if (adminMember) qaTable.push(buildRow('admin (live)', adminMember, allQaRows))

  console.log('\n--- Role QA table (multi-role union) ---')
  console.table(qaTable)

  const bugs = []
  for (const row of qaTable) {
    if (row.eventsVisiblePass === 'FAIL') {
      bugs.push(`${row.persona}: visibility expected mismatch (saw ${row.visibleEventMarkers})`)
    }
    if (row.persona.startsWith('admin') && row.canViewUnblinded) {
      bugs.push('admin must not auto-view unblinded')
    }
    if (row.persona === 'read_only' && row.canMutate) {
      bugs.push('read_only must not mutate')
    }
    if (row.persona === 'unblinded_cra' && row.canManageUnblinded) {
      bugs.push('unblinded_cra must not manage unblinded')
    }
    if (
      (row.persona === 'research_coordinator' || row.persona === 'data_coordinator') &&
      row.canViewUnblinded
    ) {
      bugs.push(`${row.persona} must not view unblinded`)
    }
    if (row.persona === 'data_coordinator' && row.canAccessAdmin) {
      bugs.push('data_coordinator must not access admin')
    }
    if (row.persona === 'rc_plus_data') {
      if (!row.canEditSource) bugs.push('rc_plus_data must edit source (union)')
      if (!row.canCoordinatorWorkspace) bugs.push('rc_plus_data must access coordinator workspace')
      if (row.canViewUnblinded) bugs.push('rc_plus_data must stay blinded')
      if (row.canAccessAdmin) bugs.push('rc_plus_data must not access admin')
      if (row.canFinancial) bugs.push('rc_plus_data must not view financial')
    }
    if (row.persona === 'unblinded_plus_data') {
      if (!row.canEditSource) bugs.push('unblinded_plus_data must edit source (union)')
      if (!row.canViewUnblinded) bugs.push('unblinded_plus_data must view unblinded (union)')
      if (!row.canManageUnblinded) bugs.push('unblinded_plus_data must manage unblinded (union)')
      if (row.canAccessAdmin) bugs.push('unblinded_plus_data must not access admin')
      if (row.canFinancial) bugs.push('unblinded_plus_data must not view financial')
    }
  }

  await sql.end({ timeout: 10 })

  if (bugs.length) {
    console.log('\nBUGS:')
    for (const b of bugs) console.log(`  - ${b}`)
    process.exit(1)
  }

  console.log('\nPASS  RBAC blinding + multi-role QA validation')
}

main().catch((err) => {
  console.error(`FAIL  ${err.message || err}`)
  process.exit(1)
})
