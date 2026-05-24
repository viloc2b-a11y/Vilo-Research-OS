/**
 * Staging/dev — ensure at least one assignable coordinator for Operational Calendar QA.
 *
 * - Creates or reuses calendar.qa.coordinator@vilo-os.staging
 * - Upserts organization_members + profiles for the Phase 2 validation org (or env override)
 * - Probes coordinator selector query + availability conflict rules (service role)
 *
 * Usage:
 *   npm run db:seed-operational-calendar-coordinator
 *
 * Env (optional):
 *   CALENDAR_QA_ORG_ID          default: org of CALENDAR_QA_STUDY_ID
 *   CALENDAR_QA_STUDY_ID        default: 6bae715a-8536-4000-8d24-22b6a3dbb8c9
 *   CALENDAR_QA_COORDINATOR_EMAIL  default: calendar.qa.coordinator@vilo-os.staging
 *   CALENDAR_SEED_ALLOW_ANY_ORG   set "true" to skip synthetic/staging org name guard
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

const DEFAULT_STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'

const QA_COORDINATOR = {
  email: 'calendar.qa.coordinator@vilo-os.staging',
  password: 'CalendarQaCoordinator!2026',
  displayName: 'Calendar QA Coordinator',
  role: 'research_coordinator',
  roles: ['research_coordinator', 'data_coordinator'],
}

function assertStagingTarget(org) {
  if (process.env.CALENDAR_SEED_ALLOW_ANY_ORG === 'true') return
  const name = org?.name ?? ''
  const looksStaging =
    /staging/i.test(name) || /synthetic/i.test(name) || /phase\s*2/i.test(name)
  if (!looksStaging) {
    throw new Error(
      `Refusing to seed: organization "${name}" (${org?.id}) does not look like staging. ` +
        'Set CALENDAR_SEED_ALLOW_ANY_ORG=true to override.',
    )
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
    console.log(`  Auth user exists: ${spec.email} (${existing.id})`)
    return existing
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: { display_name: spec.displayName },
  })
  if (error) throw new Error(`createUser ${spec.email}: ${error.message}`)
  console.log(`  Created auth user: ${spec.email} (${data.user.id})`)
  return data.user
}

async function resolveOrganization(supabase) {
  const orgId = process.env.CALENDAR_QA_ORG_ID?.trim()
  if (orgId) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .maybeSingle()
    if (error) throw new Error(`organization by id: ${error.message}`)
    if (!data) throw new Error(`Organization not found: ${orgId}`)
    return data
  }

  const studyId = (process.env.CALENDAR_QA_STUDY_ID ?? DEFAULT_STUDY_ID).trim()
  const { data: study, error: studyErr } = await supabase
    .from('studies')
    .select('organization_id, name, organizations(id, name)')
    .eq('id', studyId)
    .maybeSingle()

  if (studyErr) throw new Error(`study lookup: ${studyErr.message}`)
  if (!study?.organization_id) {
    throw new Error(`Study not found or missing organization_id: ${studyId}`)
  }

  const org = study.organizations
  if (org && typeof org === 'object' && !Array.isArray(org)) {
    return { id: org.id, name: org.name }
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', study.organization_id)
    .maybeSingle()
  if (error) throw new Error(`organization by study: ${error.message}`)
  if (!data) throw new Error(`Organization not found for study ${studyId}`)
  return data
}

function isOverlapping(start, end, block) {
  return (
    new Date(start).getTime() < new Date(block.endDatetime).getTime()
    && new Date(end).getTime() > new Date(block.startDatetime).getTime()
  )
}

function resolveAvailabilityBlocks(rows) {
  const creations = rows.filter(
    (row) =>
      row.event_type === 'calendar_availability_block_created'
      && row.payload?.calendar_event_type === 'availability_block',
  )
  const mutations = rows.filter((row) =>
    row.event_type === 'calendar_availability_block_updated'
    || row.event_type === 'calendar_availability_block_cancelled',
  )

  const resolved = new Map()
  for (const row of creations) {
    resolved.set(row.id, { payload: row.payload ?? {}, cancelled: false, row })
  }

  const sortedMutations = [...mutations].sort(
    (a, b) =>
      new Date(a.created_at ?? a.occurred_at).getTime()
      - new Date(b.created_at ?? b.occurred_at).getTime(),
  )

  for (const row of sortedMutations) {
    const payload = row.payload ?? {}
    const originalBlockId = payload.original_block_id
    if (typeof originalBlockId !== 'string') continue
    const current = resolved.get(originalBlockId)
    if (!current) continue
    if (
      row.event_type === 'calendar_availability_block_updated'
      && payload.availability_block_action === 'updated'
    ) {
      resolved.set(originalBlockId, {
        ...current,
        payload: { ...current.payload, ...payload },
      })
      continue
    }
    if (
      row.event_type === 'calendar_availability_block_cancelled'
      && payload.availability_block_action === 'cancelled'
    ) {
      resolved.set(originalBlockId, { ...current, cancelled: true })
    }
  }

  const blocks = []
  for (const block of resolved.values()) {
    if (block.cancelled) continue
    const startDatetime = block.payload.start_datetime
    const endDatetime = block.payload.end_datetime
    if (typeof startDatetime !== 'string' || typeof endDatetime !== 'string') continue
    blocks.push({
      scope: typeof block.payload.scope === 'string' ? block.payload.scope : 'user',
      affectedUserId:
        typeof block.payload.affected_user_id === 'string' ? block.payload.affected_user_id : null,
      studyId: typeof block.payload.study_id === 'string' ? block.payload.study_id : null,
      startDatetime,
      endDatetime,
    })
  }
  return blocks
}

function validateAvailabilityForAssignment(blocks, input) {
  if (!input.assignedUserId) return null
  const conflict = blocks.find((block) => {
    if (!isOverlapping(input.start, input.end, block)) return false
    if (block.scope === 'site') return true
    if (block.scope === 'user') return block.affectedUserId === input.assignedUserId
    if (block.scope === 'study') return Boolean(input.studyId && block.studyId === input.studyId)
    return false
  })
  return conflict ? 'This user is unavailable during the selected time.' : null
}

async function probeCoordinatorSelector(admin, organizationId) {
  const { data, error } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .order('role', { ascending: true })

  if (error) throw new Error(`coordinator selector probe: ${error.message}`)
  return data ?? []
}

async function probeAvailabilityRules(admin, organizationId, coordinatorUserId, studyId) {
  const { data: blockRows, error } = await admin
    .from('operational_events')
    .select('id, event_type, payload, occurred_at, created_at')
    .eq('organization_id', organizationId)
    .in('event_type', [
      'calendar_availability_block_created',
      'calendar_availability_block_updated',
      'calendar_availability_block_cancelled',
    ])
    .limit(500)

  if (error) throw new Error(`availability blocks probe: ${error.message}`)

  const blocks = resolveAvailabilityBlocks(blockRows ?? [])
  const userBlocks = blocks.filter(
    (block) => block.scope === 'user' && block.affectedUserId === coordinatorUserId,
  )

  if (userBlocks.length === 0) {
    return {
      userBlocks: 0,
      insideBlock: null,
      outsideBlock: null,
      note: 'No user-scoped blocks for seeded coordinator; create one in UI to finish QA 14–15.',
    }
  }

  const sample = userBlocks[0]
  const insideStart = sample.startDatetime
  const insideEnd = sample.endDatetime
  const outsideStart = new Date(new Date(sample.endDatetime).getTime() + 60 * 60 * 1000).toISOString()
  const outsideEnd = new Date(new Date(outsideStart).getTime() + 60 * 60 * 1000).toISOString()

  return {
    userBlocks: userBlocks.length,
    insideBlock: validateAvailabilityForAssignment(blocks, {
      assignedUserId: coordinatorUserId,
      studyId,
      start: insideStart,
      end: insideEnd,
    }),
    outsideBlock: validateAvailabilityForAssignment(blocks, {
      assignedUserId: coordinatorUserId,
      studyId,
      start: outsideStart,
      end: outsideEnd,
    }),
  }
}

async function main() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()

  const coordinatorEmail =
    (process.env.CALENDAR_QA_COORDINATOR_EMAIL ?? QA_COORDINATOR.email).trim()
  const coordinatorSpec = { ...QA_COORDINATOR, email: coordinatorEmail }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log('Resolving calendar QA organization...')
  const org = await resolveOrganization(admin)
  assertStagingTarget(org)
  console.log(`  Organization: ${org.name} (${org.id})`)

  console.log('Ensuring QA coordinator auth user...')
  const user = await ensureUser(admin, coordinatorSpec)

  await admin.from('profiles').upsert({
    id: user.id,
    display_name: coordinatorSpec.displayName,
  })

  const { data: membership, error: memErr } = await admin
    .from('organization_members')
    .upsert(
      {
        organization_id: org.id,
        user_id: user.id,
        role: coordinatorSpec.role,
        roles: coordinatorSpec.roles ?? [coordinatorSpec.role],
      },
      { onConflict: 'organization_id,user_id' },
    )
    .select('id, role, roles')
    .single()

  if (memErr) throw new Error(`organization_members upsert: ${memErr.message}`)

  const studyId = (process.env.CALENDAR_QA_STUDY_ID ?? DEFAULT_STUDY_ID).trim()

  const { error: studyMemErr } = await admin.from('study_members').upsert(
    {
      organization_id: org.id,
      study_id: studyId,
      user_id: user.id,
      role: 'coordinator',
    },
    { onConflict: 'study_id,user_id' },
  )
  if (studyMemErr) throw new Error(`study_members upsert: ${studyMemErr.message}`)

  const coordinators = await probeCoordinatorSelector(admin, org.id)
  const availabilityProbe = await probeAvailabilityRules(admin, org.id, user.id, studyId)

  const summary = {
    organization: org,
    coordinator: {
      id: user.id,
      email: coordinatorEmail,
      displayName: coordinatorSpec.displayName,
      role: membership.role,
    },
    organizationMemberCount: coordinators.length,
    coordinatorOptionsSample: coordinators.slice(0, 6).map((row) => ({
      id: row.user_id,
      role: row.role,
    })),
    availabilityConflictProbe: availabilityProbe,
    cleanup:
      'To remove: delete organization_members row for this user in this org; optional auth user delete in Supabase dashboard.',
  }

  console.log('\n--- Operational Calendar coordinator seed complete ---')
  console.log(JSON.stringify(summary, null, 2))
  console.log(
    '\nSign in to /operational-calendar — Assigned coordinator should list org members (including Calendar QA Coordinator).',
  )
  console.log(
    'Password for new auth user is in scripts/seed-operational-calendar-coordinator.mjs (staging only).',
  )

  if (coordinators.length < 1) {
    throw new Error('Probe failed: organization has zero members after seed.')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
