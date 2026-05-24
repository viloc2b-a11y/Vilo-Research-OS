/**
 * Phase 9A — operational staging hygiene (service role / direct DB).
 * Prepares phase2-validation-study + PHASE9A-PILOT-001 for coordinator rerun.
 *
 * Usage: node scripts/phase9a-staging-hygiene.mjs
 *        node scripts/phase9a-staging-hygiene.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'
import postgres from 'postgres'

const DRY_RUN = process.argv.includes('--dry-run')
const STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const ORG_ID = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const PILOT_IDENTIFIER = 'PHASE9A-PILOT-001'
const LEGACY_SUBJECT_ID = '3bae1645-b94b-441c-b081-916a03896b0e'
const CANONICAL_SDV_ID = '2ee5a544-fba6-4edb-a5c1-61ba5e2eee00'
const REQUIRED_PROCEDURE_DEF_ID = '17059af6-37fa-48a5-9bef-e82b7e2606b1'
/** Stable Screening visit for PHASE9A-PILOT-001 when present */
const PILOT_SCREENING_VISIT_ID = '6690da63-4bf1-4681-815a-3e39b7b014bc'
const SCREENING_VISIT_DEF_CODE = 'V_SCREENING'
const PILOT_COORDINATOR_USER_ID = 'd7e43ee5-5c08-489b-b293-8ef288e7fdb7'
const PILOT_COORDINATOR_EMAIL = 'calendar.qa.coordinator@vilo-os.staging'

function addDays(isoDate, offset) {
  const base = new Date(`${isoDate}T12:00:00`)
  base.setDate(base.getDate() + offset)
  return base.toISOString().slice(0, 10)
}

const report = {
  phase: '9A-staging-hygiene',
  dryRun: DRY_RUN,
  steps: [],
}

function step(name, ok, detail) {
  report.steps.push({ name, status: ok ? 'PASS' : 'FAIL', detail })
}

loadEnvFiles()
const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(dbUrl, {
  ssl: 'require',
  max: 1,
  prepare: dbUrl.includes('pooler') ? false : undefined,
})

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function ensureStagingColumns() {
  if (DRY_RUN) {
    step('staging schema columns', true, 'dry-run skip')
    return
  }
  await sql`
    alter table public.study_subjects
    add column if not exists randomization_date_time timestamptz,
    add column if not exists external_iwrs_rtsm_reference text
  `
  step('staging schema columns', true, 'randomization capture columns ensured')
}

async function ensureBinding() {
  const { data: sdv } = await admin
    .from('source_definition_versions')
    .select('id, lifecycle_status, study_id')
    .eq('id', CANONICAL_SDV_ID)
    .maybeSingle()

  if (!sdv || sdv.study_id !== STUDY_ID) {
    step('resolve published SDV', false, 'canonical SDV missing or wrong study')
    return false
  }
  if (sdv.lifecycle_status !== 'published') {
    step('resolve published SDV', false, `SDV status ${sdv.lifecycle_status}`)
    return false
  }
  step('resolve published SDV', true, CANONICAL_SDV_ID)

  if (DRY_RUN) {
    step('upsert procedure_source_binding', true, 'dry-run skip')
    return true
  }

  const { error } = await admin.from('procedure_source_bindings').upsert(
    {
      organization_id: ORG_ID,
      study_id: STUDY_ID,
      procedure_definition_id: REQUIRED_PROCEDURE_DEF_ID,
      default_source_definition_version_id: CANONICAL_SDV_ID,
    },
    { onConflict: 'study_id,procedure_definition_id' },
  )
  step('upsert procedure_source_binding', !error, error?.message ?? 'bound required procedure')
  return !error
}

/** Cancel duplicate visits for same visit_definition_id; keep best canonical row. */
async function resolveDuplicateVisits(subjectId, subjectLabel) {
  const rows = await sql`
    select v.id, v.visit_definition_id, v.visit_status, v.created_at,
           (select count(*)::int from procedure_executions pe where pe.visit_id = v.id) as pe_count
    from visits v
    where v.study_subject_id = ${subjectId}
    order by v.visit_definition_id, v.created_at asc
  `

  const byDef = new Map()
  for (const row of rows) {
    const key = row.visit_definition_id
    const list = byDef.get(key) ?? []
    list.push(row)
    byDef.set(key, list)
  }

  let cancelled = 0
  for (const [, list] of byDef) {
    if (list.length <= 1) continue
    const rank = (r) => {
      const statusScore =
        r.visit_status === 'locked' ? 5
        : r.visit_status === 'completed' ? 4
        : r.visit_status === 'in_progress' ? 3
        : r.visit_status === 'scheduled' ? 2
        : 1
      return statusScore * 1000 + Number(r.pe_count)
    }
    const sorted = [...list].sort((a, b) => rank(b) - rank(a))
    const keep = sorted[0]
    const drop = sorted.slice(1)
    for (const dup of drop) {
      if (DRY_RUN) {
        cancelled++
        continue
      }
      await sql`
        update visits
        set visit_status = 'cancelled'
        where id = ${dup.id}
      `
      cancelled++
    }
    report[`${subjectLabel}_kept_visit`] = keep.id
  }

  step(
    `cancel duplicate visits (${subjectLabel})`,
    true,
    `${cancelled} duplicate(s) marked cancelled; ${rows.length} total before`,
  )
}

async function createCleanPilot() {
  const existing = await sql`
    select id, enrollment_status from study_subjects
    where study_id = ${STUDY_ID} and subject_identifier = ${PILOT_IDENTIFIER}
    limit 1
  `

  let subjectId = existing[0]?.id ?? null

  if (!subjectId && !DRY_RUN) {
    const inserted = await sql`
      insert into study_subjects (organization_id, study_id, subject_identifier, enrollment_status)
      values (${ORG_ID}, ${STUDY_ID}, ${PILOT_IDENTIFIER}, 'screening')
      returning id
    `
    subjectId = inserted[0].id
    step('create pilot subject', true, `${PILOT_IDENTIFIER} (${subjectId})`)
  } else if (subjectId) {
    step('create pilot subject', true, `exists ${subjectId}`)
  } else {
    step('create pilot subject', true, 'dry-run would create')
    return null
  }

  if (DRY_RUN) return subjectId

  const anchorDate = new Date().toISOString().slice(0, 10)
  const randIso = new Date().toISOString()

  const { error: enrollErr } = await admin
    .from('study_subjects')
    .update({
      enrollment_status: 'enrolled',
      schedule_anchor_date: null,
      visit_schedule_generated_at: null,
      randomization_number: null,
      randomization_arm: null,
    })
    .eq('id', subjectId)

  if (enrollErr) {
    step('pilot enrolled', false, enrollErr.message)
    return subjectId
  }

  const { error: randErr } = await admin
    .from('study_subjects')
    .update({
      enrollment_status: 'randomized',
      randomization_number: 'PHASE9A-RAND-001',
      randomization_arm: 'A',
      randomization_date_time: randIso,
      external_iwrs_rtsm_reference: 'PHASE9A-IWRS-CONF-001',
      schedule_anchor_date: anchorDate,
    })
    .eq('id', subjectId)

  if (randErr) {
    step('pilot randomized', false, randErr.message)
    return subjectId
  }

  step('pilot lifecycle', true, 'screening → enrolled → randomized (hygiene seed)')

  const scheduleResult = await generateScheduleInline(subjectId, anchorDate)
  step(
    'generate visit schedule',
    scheduleResult.ok,
    scheduleResult.ok
      ? `created ${scheduleResult.createdCount} visit(s)`
      : scheduleResult.error,
  )

  return subjectId
}

async function generateScheduleInline(studySubjectId, anchorDate) {
  const { data: subject, error: subErr } = await admin
    .from('study_subjects')
    .select('id, organization_id, study_id, enrollment_status, visit_schedule_generated_at')
    .eq('id', studySubjectId)
    .maybeSingle()

  if (subErr || !subject) return { ok: false, error: subErr?.message ?? 'subject missing' }
  if (!['enrolled', 'randomized', 'completed'].includes(subject.enrollment_status)) {
    return { ok: false, error: `status ${subject.enrollment_status} cannot schedule` }
  }

  const { data: definitions } = await admin
    .from('visit_definitions')
    .select('id, sort_order, target_day, window_min_offset, window_max_offset')
    .eq('study_id', subject.study_id)
    .order('sort_order', { ascending: true })

  if (!definitions?.length) return { ok: false, error: 'no visit definitions' }

  const { data: existingVisits } = await admin
    .from('visits')
    .select('visit_definition_id')
    .eq('study_subject_id', studySubjectId)
    .neq('visit_status', 'cancelled')

  const existingDefIds = new Set((existingVisits ?? []).map((v) => v.visit_definition_id))
  if (existingDefIds.size >= definitions.length && subject.visit_schedule_generated_at) {
    return { ok: true, createdCount: 0, skipped: true }
  }

  const { data: procedureMaps } = await admin
    .from('visit_def_procedure_map')
    .select('visit_definition_id, procedure_definition_id, is_required, sort_order')
    .eq('study_id', subject.study_id)

  const { data: bindings } = await admin
    .from('procedure_source_bindings')
    .select('procedure_definition_id, default_source_definition_version_id')
    .eq('study_id', subject.study_id)

  const bindingByProc = new Map(
    (bindings ?? []).map((b) => [b.procedure_definition_id, b.default_source_definition_version_id]),
  )

  let createdCount = 0
  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i]
    if (existingDefIds.has(def.id)) continue

    const targetDay = typeof def.target_day === 'number' && def.target_day > 0 ? def.target_day : i + 1
    const targetDate = addDays(anchorDate, targetDay - 1)
    const windowStart = addDays(targetDate, def.window_min_offset ?? -1)
    const windowEnd = addDays(targetDate, def.window_max_offset ?? 2)

    const { data: visit, error: visitErr } = await admin
      .from('visits')
      .insert({
        organization_id: subject.organization_id,
        study_id: subject.study_id,
        study_subject_id: studySubjectId,
        visit_definition_id: def.id,
        visit_day: targetDay,
        target_date: targetDate,
        scheduled_date: targetDate,
        window_start: windowStart,
        window_end: windowEnd,
        window_status: 'inside_window',
        confirmation_status: 'pending',
        visit_status: 'scheduled',
      })
      .select('id')
      .single()

    if (visitErr) return { ok: false, error: visitErr.message }

    const mapsForVisit = (procedureMaps ?? []).filter((m) => m.visit_definition_id === def.id)
    for (const m of mapsForVisit) {
      const sdvId = bindingByProc.get(m.procedure_definition_id) ?? null
      if (m.is_required && !sdvId) {
        return { ok: false, error: `missing binding for required procedure on visit def ${def.id}` }
      }
      const { error: peErr } = await admin.from('procedure_executions').insert({
        organization_id: subject.organization_id,
        study_id: subject.study_id,
        visit_id: visit.id,
        procedure_definition_id: m.procedure_definition_id,
        execution_status: 'pending',
        ...(sdvId ? { source_definition_version_id: sdvId } : {}),
      })
      if (peErr) return { ok: false, error: peErr.message }
    }

    createdCount++
    existingDefIds.add(def.id)
  }

  await admin
    .from('study_subjects')
    .update({
      schedule_anchor_date: anchorDate,
      visit_schedule_generated_at: new Date().toISOString(),
    })
    .eq('id', studySubjectId)

  return { ok: true, createdCount }
}

/**
 * Ensure Screening visit has a materialized procedure_execution with published SDV.
 * Uses the same insert shape as generateScheduleInline (approved schedule path).
 */
async function ensurePilotScreeningProcedure(subjectId) {
  if (!subjectId) {
    step('ensure pilot screening PE', true, 'no pilot subject — skip')
    return
  }

  const visitRows = await sql`
    select v.id, v.visit_definition_id, vd.code
    from visits v
    join visit_definitions vd on vd.id = v.visit_definition_id
    where v.study_subject_id = ${subjectId}
      and v.visit_status <> 'cancelled'
      and (v.id = ${PILOT_SCREENING_VISIT_ID}::uuid or vd.code = ${SCREENING_VISIT_DEF_CODE})
    order by case when v.id = ${PILOT_SCREENING_VISIT_ID}::uuid then 0 else 1 end, v.created_at asc
    limit 1
  `

  const visit = visitRows[0]
  if (!visit) {
    step('ensure pilot screening PE', false, 'no active Screening visit on pilot subject')
    return
  }

  const peRows = await sql`
    select pe.id, pe.source_definition_version_id,
           (select count(*)::int from source_response_sets srs where srs.procedure_execution_id = pe.id) as rs_count
    from procedure_executions pe
    where pe.visit_id = ${visit.id}
      and pe.procedure_definition_id = ${REQUIRED_PROCEDURE_DEF_ID}
    order by pe.created_at asc
  `

  let peId = peRows[0]?.id ?? null
  let peSdv = peRows[0]?.source_definition_version_id ?? null
  const rsCount = Number(peRows[0]?.rs_count ?? 0)

  if (!peId && !DRY_RUN) {
    const { data: inserted, error } = await admin
      .from('procedure_executions')
      .insert({
        organization_id: ORG_ID,
        study_id: STUDY_ID,
        visit_id: visit.id,
        procedure_definition_id: REQUIRED_PROCEDURE_DEF_ID,
        execution_status: 'pending',
        source_definition_version_id: CANONICAL_SDV_ID,
      })
      .select('id, source_definition_version_id')
      .single()

    if (error) {
      step('ensure pilot screening PE', false, error.message)
      return
    }
    peId = inserted.id
    peSdv = inserted.source_definition_version_id
    step(
      'ensure pilot screening PE',
      true,
      `inserted ${peId} on visit ${visit.id} (${visit.code}) sdv=${peSdv}`,
    )
    report.pilotScreeningProcedureExecutionId = peId
    report.pilotScreeningCapturePath = `/source/capture/${peId}`
    return
  }

  if (!peId) {
    step('ensure pilot screening PE', true, 'dry-run would insert screening PE')
    return
  }

  if (peSdv === CANONICAL_SDV_ID) {
    step(
      'ensure pilot screening PE',
      true,
      `exists ${peId} sdv aligned (${CANONICAL_SDV_ID})`,
    )
    report.pilotScreeningProcedureExecutionId = peId
    report.pilotScreeningCapturePath = `/source/capture/${peId}`
    return
  }

  if (rsCount === 0 && peSdv !== CANONICAL_SDV_ID && !DRY_RUN) {
    const { error: updErr } = await admin
      .from('procedure_executions')
      .update({ source_definition_version_id: CANONICAL_SDV_ID })
      .eq('id', peId)

    if (updErr) {
      step(
        'ensure pilot screening PE',
        true,
        `exists ${peId} sdv=${peSdv} (rebind blocked: ${updErr.message})`,
      )
    } else {
      peSdv = CANONICAL_SDV_ID
      step('ensure pilot screening PE', true, `rebound ${peId} to canonical SDV`)
    }
  } else if (peSdv !== CANONICAL_SDV_ID) {
    step(
      'ensure pilot screening PE',
      true,
      `exists ${peId} sdv=${peSdv} binding=${CANONICAL_SDV_ID} rs=${rsCount} (SDV immutable after capture)`,
    )
  }

  report.pilotScreeningProcedureExecutionId = peId
  report.pilotScreeningCapturePath = `/source/capture/${peId}`
}

/**
 * study_members enrollment scope for capture RPC + source_response_sets RLS.
 * Org-level research_coordinator alone is insufficient (user_has_study_access).
 */
async function ensurePilotCoordinatorStudyAccess() {
  if (DRY_RUN) {
    step('pilot coordinator study_members', true, 'dry-run skip')
    return
  }

  const { error } = await admin.from('study_members').upsert(
    {
      organization_id: ORG_ID,
      study_id: STUDY_ID,
      user_id: PILOT_COORDINATOR_USER_ID,
      role: 'coordinator',
    },
    { onConflict: 'study_id,user_id' },
  )

  step(
    'pilot coordinator study_members',
    !error,
    error?.message ?? `${PILOT_COORDINATOR_EMAIL} → study_members.coordinator`,
  )
}

async function proofReadiness() {
  const blockers = []
  const { count: bindingCount } = await admin
    .from('procedure_source_bindings')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', STUDY_ID)

  if (!bindingCount) blockers.push('No procedure source bindings.')

  const { data: pkg } = await admin
    .from('source_publish_packages')
    .select('package_id, validation_status, persisted_at')
    .eq('study_id', STUDY_ID)
    .not('persisted_at', 'is', null)
    .order('persisted_at', { ascending: false })
    .limit(1)

  if (!pkg?.[0]) blockers.push('No persisted publish package.')
  else if (pkg[0].validation_status === 'invalid') blockers.push('Published package invalid.')

  if (pkg?.[0]?.package_id) {
    const { data: consistent, error } = await admin.rpc('phase4c_publish_package_is_consistent', {
      p_organization_id: ORG_ID,
      p_package_id: pkg[0].package_id,
    })
    if (error) blockers.push(error.message)
    else if (consistent !== true) blockers.push('Package consistency failed.')
  }

  const canExecute = blockers.length === 0
  report.readyForExecution = canExecute
  report.blockers = blockers
  step('READY_FOR_EXECUTION', canExecute, blockers.join('; ') || 'ok')
}

async function pilotSnapshot(subjectId) {
  if (!subjectId) return
  const visits = await sql`
    select v.id, vd.code, vd.label, v.visit_status, v.visit_review_status, v.scheduled_date
    from visits v
    join visit_definitions vd on vd.id = v.visit_definition_id
    where v.study_subject_id = ${subjectId} and v.visit_status <> 'cancelled'
    order by v.scheduled_date nulls last, vd.sort_order
  `
  report.pilotVisits = visits
  step(
    'pilot visit chronology',
    visits.length >= 1 && visits.length <= 5,
    `${visits.length} active visit(s)`,
  )
}

async function main() {
  try {
    await ensureStagingColumns()
    await ensureBinding()
    await resolveDuplicateVisits(LEGACY_SUBJECT_ID, 'legacy_SUBJ-P2VAL')
    const pilotId = await createCleanPilot()
    if (pilotId && !DRY_RUN) {
      await resolveDuplicateVisits(pilotId, 'PHASE9A-PILOT')
      await ensurePilotScreeningProcedure(pilotId)
      await ensurePilotCoordinatorStudyAccess()
    } else if (pilotId && DRY_RUN) {
      await ensurePilotScreeningProcedure(pilotId)
      await ensurePilotCoordinatorStudyAccess()
    }
    await proofReadiness()
    await pilotSnapshot(pilotId)
    report.pilotSubjectId = pilotId
    report.studyId = STUDY_ID
    report.pilotIdentifier = PILOT_IDENTIFIER
  } finally {
    await sql.end()
  }

  console.log(JSON.stringify(report, null, 2))
  const failed = report.steps.filter((s) => s.status === 'FAIL').length
  process.exit(failed > 0 || !report.readyForExecution ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
