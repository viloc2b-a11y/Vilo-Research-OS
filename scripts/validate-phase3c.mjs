/**
 * Phase 3C validation: transactional `complete_visit` + `lock_visit` (+ procedure guard regression).
 *
 * Prerequisites:
 * - Migrations through 0013 (`npm run db:migrate`).
 * - Phase 1b + Phase 2 fixture (same harness as Phase 3B).
 *
 * Usage: npm run db:validate-phase3c
 *
 * Writes: docs/PHASE3C-VALIDATION-RESULTS.md
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, projectRoot, requireEnv } from './lib/env.mjs'

const SYNTHETIC = {
  orgAName: 'Synthetic Site Alpha (Staging)',
  userA: { email: 'synthetic.staff.a@vilo-os.staging', password: 'SyntheticViloOs!2026A' },
  userB: { email: 'synthetic.staff.b@vilo-os.staging', password: 'SyntheticViloOs!2026B' },
  userC: {
    email: 'synthetic.staff.c.orga.only@vilo-os.staging',
    password: 'SyntheticViloOs!2026C',
    displayName: 'Synthetic Org-A Member Only',
    orgRole: 'member',
  },
}

const studySlug = 'phase2-validation-study'

const results = {
  runAt: new Date().toISOString(),
  phase: '3C',
  checks: [],
  summary: { passed: 0, failed: 0, blocked: 0 },
}

function record(name, status, detail) {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else if (status === 'BLOCKED') results.summary.blocked++
}

function clientAsUser(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function provisionUserC(admin, organizationIdAlpha, excludeStudyId) {
  let userC =
    (
      await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
    ).data?.users?.find((u) => u.email === SYNTHETIC.userC.email) ?? null

  if (!userC) {
    await admin.auth.admin.createUser({
      email: SYNTHETIC.userC.email,
      password: SYNTHETIC.userC.password,
      email_confirm: true,
      user_metadata: { display_name: 'Synthetic Org-A Member Only (Phase 3C)' },
    })
    userC =
      (
        await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })
      ).data?.users?.find((u) => u.email === SYNTHETIC.userC.email) ?? null
  }

  if (!userC?.id) return null

  await admin.from('profiles').upsert({
    id: userC.id,
    display_name: SYNTHETIC.userC.displayName,
  })

  await admin.from('organization_members').upsert(
    {
      organization_id: organizationIdAlpha,
      user_id: userC.id,
      role: SYNTHETIC.userC.orgRole,
    },
    { onConflict: 'organization_id,user_id' },
  )

  await admin
    .from('study_members')
    .delete()
    .eq('study_id', excludeStudyId)
    .eq('user_id', userC.id)

  return userC
}

function finishAndExit(exitCode) {
  writeReportMd()
  const { passed, failed, blocked } = results.summary
  const statusLabel =
    failed > 0 ? 'RED' : blocked > 0 ? 'AMBER (blocked)' : 'GREEN'
  console.log(
    `\nPhase 3C validation: ${passed} pass, ${failed} fail, ${blocked} blocked — ${statusLabel}`,
  )
  const problems = results.checks.filter((c) => c.status !== 'PASS')
  if (problems.length) {
    console.log('Non-pass checks:')
    for (const c of problems) {
      console.log(`  [${c.status}] ${c.name}: ${c.detail}`)
    }
  }
  console.log('Report: docs/PHASE3C-VALIDATION-RESULTS.md')
  process.exit(exitCode)
}

function writeReportMd() {
  const out = resolve(projectRoot, 'docs/PHASE3C-VALIDATION-RESULTS.md')
  const lines = [
    '# Phase 3C — Visit lifecycle RPC validation results',
    '',
    `**Run at:** ${results.runAt}`,
    '',
    '## Summary',
    '',
    '| Result | Count |',
    '|--------|-------|',
    `| PASS | ${results.summary.passed} |`,
    `| FAIL | ${results.summary.failed} |`,
    `| BLOCKED | ${results.summary.blocked} |`,
    '',
    results.summary.failed === 0 && results.summary.blocked === 0
      ? '**Phase 3C status:** GREEN — visit complete + lock + isolation checks executed.'
      : results.summary.failed > 0
        ? '**Phase 3C status:** RED — address FAIL rows above.'
        : '**Phase 3C status:** AMBER — unblock BLOCKED rows.',
    '',
    '## Checks',
    '',
    '| Check | Status | Detail |',
    '|-------|--------|--------|',
    ...results.checks.map(
      (c) => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|')} |`,
    ),
    '',
    '## Commands',
    '',
    '`npm run db:validate-phase3c`',
    '',
  ]
  writeFileSync(out, lines.join('\n'), 'utf8')
}

async function countEvents(admin, visitId, execId, type) {
  const q = admin
    .from('operational_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', type)
  if (type === 'PROCEDURE_COMPLETED') {
    q.eq('procedure_execution_id', execId)
  } else {
    q.eq('visit_id', visitId)
  }
  const { count, error } = await q
  if (error) return { n: null, error }
  return { n: Number(count ?? 0), error: null }
}

async function main() {
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: orgA, error: orgErr } = await admin
    .from('organizations')
    .select('id')
    .eq('name', SYNTHETIC.orgAName)
    .maybeSingle()

  if (orgErr || !orgA) {
    record('fixture_org_alpha', 'BLOCKED', orgErr?.message ?? 'missing')
    finishAndExit(2)
  }

  const { data: study, error: stErr } = await admin
    .from('studies')
    .select('id')
    .eq('organization_id', orgA.id)
    .eq('slug', studySlug)
    .maybeSingle()

  if (stErr || !study?.id) {
    record('fixture_study', 'BLOCKED', stErr?.message ?? `missing ${studySlug}`)
    finishAndExit(2)
  }

  const subjectExternalId = 'SUBJ-P2VAL-001'
  const { data: subjectRow, error: subErr } = await admin
    .from('study_subjects')
    .select('id')
    .eq('study_id', study.id)
    .eq('subject_identifier', subjectExternalId)
    .maybeSingle()

  if (subErr || !subjectRow) {
    record('fixture_subject', 'BLOCKED', subErr?.message ?? 'missing subject')
    finishAndExit(2)
  }

  const { data: visitDefMeta, error: vdErr } = await admin
    .from('visit_definitions')
    .select('id')
    .eq('study_id', study.id)
    .eq('code', 'V_SCREENING')
    .maybeSingle()

  if (vdErr || !visitDefMeta?.id) {
    record('fixture_visit_definition', 'BLOCKED', vdErr?.message ?? 'missing V_SCREENING')
    finishAndExit(2)
  }

  const { data: visitCandidates, error: viErr } = await admin
    .from('visits')
    .select('id, visit_status, created_at')
    .eq('study_subject_id', subjectRow.id)
    .eq('visit_definition_id', visitDefMeta.id)
    .order('created_at', { ascending: true })

  const visitCount = visitCandidates?.length ?? 0
  const visitRow = visitCandidates?.[0] ?? null

  if (viErr || !visitRow?.id) {
    record('fixture_visit', 'BLOCKED', viErr?.message ?? 'missing visit')
    finishAndExit(2)
  }

  if (visitCount > 1) {
    record(
      'fixture_visit_resolve',
      'PASS',
      `${visitCount} V_SCREENING visits for subject; using canonical oldest id=${visitRow.id}`,
    )
  }

  const visitId = visitRow.id

  const { data: procDef, error: pdErr } = await admin
    .from('procedure_definitions')
    .select('id')
    .eq('study_id', study.id)
    .eq('code', 'PROC_CBC')
    .maybeSingle()

  if (pdErr || !procDef?.id) {
    record('fixture_procedure_definition', 'BLOCKED', pdErr?.message ?? 'missing PROC_CBC')
    finishAndExit(2)
  }

  const { data: execRow, error: peErr } = await admin
    .from('procedure_executions')
    .select('id')
    .eq('visit_id', visitId)
    .eq('procedure_definition_id', procDef.id)
    .maybeSingle()

  if (peErr || !execRow?.id) {
    record('fixture_procedure_execution', 'BLOCKED', peErr?.message ?? 'missing PE')
    finishAndExit(2)
  }

  const execId = execRow.id

  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 })
  const userB = usersList?.users?.find((u) => u.email === SYNTHETIC.userB.email)
  await provisionUserC(admin, orgA.id, study.id)

  async function resetLifecycleFixture() {
    await admin.from('operational_events').delete().eq('visit_id', visitId).in('event_type', [
      'VISIT_COMPLETED',
      'VISIT_LOCKED',
    ])
    await admin
      .from('operational_events')
      .delete()
      .eq('procedure_execution_id', execId)
      .eq('event_type', 'PROCEDURE_COMPLETED')
    await admin
      .from('visits')
      .update({
        visit_status: 'scheduled',
        actual_date: null,
        completed_at: null,
        occurred_at: null,
        locked_at: null,
        locked_by_user_id: null,
      })
      .eq('id', visitId)
    await admin
      .from('procedure_executions')
      .update({
        execution_status: 'pending',
        performed_at: null,
        performed_by_user_id: null,
      })
      .eq('id', execId)
  }

  await resetLifecycleFixture()
  record('fixture_reset_visit_lifecycle', 'PASS', `${visitId} / ${execId}`)

  const anonSign = createClient(url, anon)
  const signInA = await anonSign.auth.signInWithPassword({
    email: SYNTHETIC.userA.email,
    password: SYNTHETIC.userA.password,
  })
  if (signInA.error || !signInA.data.session) {
    record('jwt_user_a', 'BLOCKED', signInA.error?.message ?? 'no jwt')
    finishAndExit(2)
  }

  const clientA = clientAsUser(url, anon, signInA.data.session.access_token)

  {
    const { data: denyTooEarly, error: eCv0 } = await clientA.rpc('complete_visit', {
      p_visit_id: visitId,
    })
    const bad =
      eCv0
      || denyTooEarly?.ok === true
      || !String(denyTooEarly?.error ?? '').toLowerCase().includes('required')
    record(
      'cannot_complete_visit_with_incomplete_required_procedures',
      bad ? 'FAIL' : 'PASS',
      eCv0?.message ?? JSON.stringify(denyTooEarly ?? null),
    )
  }

  let peCount0 = await countEvents(admin, visitId, execId, 'PROCEDURE_COMPLETED')

  const { data: rpcPe, error: ePe } = await clientA.rpc('complete_procedure_execution', {
    p_procedure_execution_id: execId,
  })
  record(
    'rpc_complete_procedure_execution_prerequisite',
    ePe || !rpcPe?.ok ? 'FAIL' : 'PASS',
    ePe?.message ?? JSON.stringify(rpcPe ?? null),
  )

  let peCount1 = await countEvents(admin, visitId, execId, 'PROCEDURE_COMPLETED')
  record(
    'procedure_completed_event_emitted_once',
    !peCount0.error
      && !peCount1.error
      && peCount1.n - peCount0.n === 1
      ? 'PASS'
      : 'FAIL',
    `delta=${String(peCount1.n - peCount0.n)} before=${peCount0.n ?? 'err'} after=${peCount1.n ?? 'err'}`,
  )

  let vc0 = await countEvents(admin, visitId, execId, 'VISIT_COMPLETED')
  const { data: cv1, error: ecv1 } = await clientA.rpc('complete_visit', {
    p_visit_id: visitId,
  })

  record(
    'rpc_user_a_first_complete_visit',
    ecv1 || !cv1?.ok || cv1.idempotent === true ? 'FAIL' : 'PASS',
    ecv1?.message ?? JSON.stringify(cv1 ?? null),
  )

  let vc1 = await countEvents(admin, visitId, execId, 'VISIT_COMPLETED')
  record(
    'visit_completed_event_emitted_once',
    !vc0.error && !vc1.error && vc1.n - vc0.n === 1 ? 'PASS' : 'FAIL',
    `delta=${String(vc1.n - vc0.n)} before=${vc0.n ?? 'err'} after=${vc1.n ?? 'err'}`,
  )

  const visitCompletedEventId = cv1?.operational_event_id ?? null

  const { data: rpcCv2, error: ecv2 } = await clientA.rpc('complete_visit', {
    p_visit_id: visitId,
  })
  const visitCompletedCountAfterSecondRpc = await countEvents(
    admin,
    visitId,
    execId,
    'VISIT_COMPLETED',
  )
  const idemVisitOk =
    !ecv2
    && rpcCv2?.ok === true
    && rpcCv2.idempotent === true
    && rpcCv2.operational_event_id === visitCompletedEventId
    && !visitCompletedCountAfterSecondRpc.error
    && visitCompletedCountAfterSecondRpc.n === vc1.n
  record(
    'second_complete_visit_idempotent_no_extra_event',
    idemVisitOk ? 'PASS' : 'FAIL',
    JSON.stringify({ rpc: rpcCv2 ?? null, countAfter: visitCompletedCountAfterSecondRpc.n }),
  )

  let visitLockedCount0 = await countEvents(admin, visitId, execId, 'VISIT_LOCKED')
  const { data: lockRpc1, error: elv1 } = await clientA.rpc('lock_visit', { p_visit_id: visitId })
  record(
    'rpc_first_lock_visit',
    elv1 || !lockRpc1?.ok || lockRpc1.idempotent === true ? 'FAIL' : 'PASS',
    elv1?.message ?? JSON.stringify(lockRpc1 ?? null),
  )

  let visitLockedCount1 = await countEvents(admin, visitId, execId, 'VISIT_LOCKED')
  record(
    'visit_locked_event_emitted_once',
    !visitLockedCount0.error
      && !visitLockedCount1.error
      && visitLockedCount1.n - visitLockedCount0.n === 1
      ? 'PASS'
      : 'FAIL',
    `delta=${String(visitLockedCount1.n - visitLockedCount0.n)} before=${visitLockedCount0.n ?? 'err'} after=${visitLockedCount1.n ?? 'err'}`,
  )

  const visitLockedOperationalEventId = lockRpc1?.operational_event_id ?? null

  const { data: peRowDb } = await admin
    .from('procedure_executions')
    .select('execution_status')
    .eq('id', execId)
    .maybeSingle()
  record(
    'lock_visit_sets_procedure_execution_to_verified',
    peRowDb?.execution_status === 'verified' ? 'PASS' : 'FAIL',
    JSON.stringify(peRowDb ?? null),
  )

  const { data: lockRpc2, error: elv2 } = await clientA.rpc('lock_visit', {
    p_visit_id: visitId,
  })
  const visitLockedCount2 = await countEvents(admin, visitId, execId, 'VISIT_LOCKED')

  const idemLockOk =
    !elv2
    && lockRpc2?.ok === true
    && lockRpc2.idempotent === true
    && lockRpc2.operational_event_id === visitLockedOperationalEventId
    && !visitLockedCount2.error
    && visitLockedCount2.n === visitLockedCount1.n
  record(
    'second_lock_visit_idempotent_no_extra_event',
    idemLockOk ? 'PASS' : 'FAIL',
    JSON.stringify({ rpc: lockRpc2 ?? null, countAfter: visitLockedCount2.n }),
  )

  {
    await admin
      .from('procedure_executions')
      .update({
        execution_status: 'pending',
        performed_at: null,
        performed_by_user_id: null,
      })
      .eq('id', execId)

    const { data: gated, error } = await clientA.rpc('complete_procedure_execution', {
      p_procedure_execution_id: execId,
    })

    record(
      'procedure_completion_blocked_when_visit_locked',
      !error
        && gated?.ok === false
        && String(gated?.error ?? '')
          .toLowerCase()
          .includes('visit')
          && String(gated?.visit_status ?? '').toLowerCase() === 'locked'
        ? 'PASS'
        : 'FAIL',
      error?.message ?? JSON.stringify(gated ?? null),
    )

    await admin
      .from('procedure_executions')
      .update({ execution_status: 'verified', performed_at: new Date().toISOString() })
      .eq('id', execId)
  }

  if (userB?.id) {
    const anonB = createClient(url, anon)
    const siB = await anonB.auth.signInWithPassword({
      email: SYNTHETIC.userB.email,
      password: SYNTHETIC.userB.password,
    })
    if (!siB.error && siB.data.session) {
      const clientB = clientAsUser(url, anon, siB.data.session.access_token)
      const { data: rbC } = await clientB.rpc('complete_visit', { p_visit_id: visitId })
      const { data: rbL } = await clientB.rpc('lock_visit', { p_visit_id: visitId })
      record(
        'user_b_cannot_complete_or_lock_org_a_visit',
        rbC?.ok === false && rbL?.ok === false ? 'PASS' : 'FAIL',
        `complete=${JSON.stringify(rbC)} lock=${JSON.stringify(rbL)}`,
      )
    } else {
      record('user_b_cannot_complete_or_lock_org_a_visit', 'BLOCKED', siB.error?.message ?? 'no jwt')
    }
  } else {
    record('user_b_cannot_complete_or_lock_org_a_visit', 'BLOCKED', 'User B missing')
  }

  const anonC = createClient(url, anon)
  const siC = await anonC.auth.signInWithPassword({
    email: SYNTHETIC.userC.email,
    password: SYNTHETIC.userC.password,
  })
  if (!siC.error && siC.data.session) {
    const clientC = clientAsUser(url, anon, siC.data.session.access_token)
    const { data: rcC } = await clientC.rpc('complete_visit', { p_visit_id: visitId })
    const { data: rcL } = await clientC.rpc('lock_visit', { p_visit_id: visitId })
    record(
      'user_c_org_only_cannot_complete_or_lock_visit',
      rcC?.ok === false && rcL?.ok === false ? 'PASS' : 'FAIL',
      `complete=${JSON.stringify(rcC)} lock=${JSON.stringify(rcL)}`,
    )
  } else {
    record('user_c_org_only_cannot_complete_or_lock_visit', 'BLOCKED', siC.error?.message ?? 'no jwt')
  }

  let peFinal = await countEvents(admin, visitId, execId, 'PROCEDURE_COMPLETED')
  let vcFinal = await countEvents(admin, visitId, execId, 'VISIT_COMPLETED')
  let vlFinal = await countEvents(admin, visitId, execId, 'VISIT_LOCKED')
  record(
    'event_counts_procedure_visit_complete_match_expectation',
    !peFinal.error
      && !vcFinal.error
      && !vlFinal.error
      && peFinal.n === 1
      && vcFinal.n === 1
      && vlFinal.n === 1
      ? 'PASS'
      : 'FAIL',
    `PROCEDURE_COMPLETED=${peFinal.n} VISIT_COMPLETED=${vcFinal.n} VISIT_LOCKED=${vlFinal.n}`,
  )

  const exitCode = results.summary.failed > 0 ? 1 : results.summary.blocked > 0 ? 2 : 0
  finishAndExit(exitCode)
}

main().catch((err) => {
  record('runtime', 'FAIL', String(err.message || err))
  console.error('Phase 3C validation runtime error:', err.message || err)
  if (err.stack) console.error(err.stack)
  finishAndExit(1)
})
