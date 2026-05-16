/**
 * Phase 3B validation: transactional `complete_procedure_execution` RPC.
 *
 * Prerequisites:
 * - Migrations through 0013 applied (`npm run db:migrate`) — visit lock semantics.
 * - Phase 1b provision + Phase 2 seed (same fixtures as scripts/validate-phase2.mjs).
 *
 * Usage: npm run db:validate-phase3b
 *
 * Writes: docs/PHASE3B-VALIDATION-RESULTS.md
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
  phase: '3B',
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
      user_metadata: { display_name: 'Synthetic Org-A Member Only (Phase 3B)' },
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

function writeReportMd() {
  const out = resolve(projectRoot, 'docs/PHASE3B-VALIDATION-RESULTS.md')
  const lines = [
    '# Phase 3B — RPC validation results',
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
      ? '**Phase 3B status:** GREEN — RPC idempotency + isolation checks executed.'
      : results.summary.failed > 0
        ? '**Phase 3B status:** RED — address FAIL rows above.'
        : '**Phase 3B status:** AMBER — unblock BLOCKED rows.',
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
    '`npm run db:validate-phase3b`',
    '',
  ]
  writeFileSync(out, lines.join('\n'), 'utf8')
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
    record('seed_org_alpha', 'BLOCKED', orgErr?.message ?? 'Org Alpha not found.')
    writeReportMd()
    process.exit(2)
  }

  const { data: study, error: stErr } = await admin
    .from('studies')
    .select('id')
    .eq('organization_id', orgA.id)
    .eq('slug', studySlug)
    .maybeSingle()

  if (stErr || !study) {
    record('fixture_study', 'BLOCKED', stErr?.message ?? `Study slug ${studySlug} missing — run db:validate-phase2 once`)
    writeReportMd()
    process.exit(2)
  }

  const subjectExternalId = 'SUBJ-P2VAL-001'
  const { data: subjectRow, error: subErr } = await admin
    .from('study_subjects')
    .select('id')
    .eq('study_id', study.id)
    .eq('subject_identifier', subjectExternalId)
    .maybeSingle()

  if (subErr || !subjectRow) {
    record('fixture_subject', 'BLOCKED', subErr?.message ?? 'Phase 2 subject missing')
    writeReportMd()
    process.exit(2)
  }

  const { data: visitDefMeta, error: vdErr } = await admin
    .from('visit_definitions')
    .select('id')
    .eq('study_id', study.id)
    .eq('code', 'V_SCREENING')
    .maybeSingle()

  if (vdErr || !visitDefMeta?.id) {
    record('fixture_visit_definition_v_screening', 'BLOCKED', vdErr?.message ?? 'missing')
    writeReportMd()
    process.exit(2)
  }

  const { data: visitRow, error: viErr } = await admin
    .from('visits')
    .select('id')
    .eq('study_subject_id', subjectRow.id)
    .eq('visit_definition_id', visitDefMeta.id)
    .maybeSingle()

  if (viErr || !visitRow?.id) {
    record('fixture_visit', 'BLOCKED', viErr?.message ?? 'V_SCREENING visit missing')
    writeReportMd()
    process.exit(2)
  }

  const { data: procDef, error: pdErr } = await admin
    .from('procedure_definitions')
    .select('id')
    .eq('study_id', study.id)
    .eq('code', 'PROC_CBC')
    .maybeSingle()

  if (pdErr || !procDef) {
    record('fixture_procedure_definition', 'BLOCKED', pdErr?.message ?? 'PROC_CBC missing')
    writeReportMd()
    process.exit(2)
  }

  const { data: execRow, error: peErr } = await admin
    .from('procedure_executions')
    .select('id')
    .eq('visit_id', visitRow.id)
    .eq('procedure_definition_id', procDef.id)
    .maybeSingle()

  if (peErr || !execRow?.id) {
    record('fixture_procedure_execution', 'BLOCKED', peErr?.message ?? 'procedure_execution missing')
    writeReportMd()
    process.exit(2)
  }

  const execId = execRow.id

  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 })
  const userB = usersList?.users?.find((u) => u.email === SYNTHETIC.userB.email)
  await provisionUserC(admin, orgA.id, study.id)

  {
    await admin.from('operational_events').delete().eq('procedure_execution_id', execId).eq('event_type', 'PROCEDURE_COMPLETED')
    await admin
      .from('procedure_executions')
      .update({
        execution_status: 'pending',
        performed_at: null,
        performed_by_user_id: null,
      })
      .eq('id', execId)
    // Phase 3C lock_visit may leave the synthetic visit locked after validate-phase3c; RPC refuses completion on locked visits.
    await admin
      .from('visits')
      .update({
        visit_status: 'in_progress',
        locked_at: null,
        locked_by_user_id: null,
      })
      .eq('id', visitRow.id)
    record('fixture_reset_procedure_pending', 'PASS', execId)
  }

  async function countProcedureCompletedEvents() {
    const { count, error } = await admin
      .from('operational_events')
      .select('*', { count: 'exact', head: true })
      .eq('procedure_execution_id', execId)
      .eq('event_type', 'PROCEDURE_COMPLETED')
    if (error) return { n: null, error }
    return { n: Number(count ?? 0), error: null }
  }

  const anonSign = createClient(url, anon)
  const signInA = await anonSign.auth.signInWithPassword({
    email: SYNTHETIC.userA.email,
    password: SYNTHETIC.userA.password,
  })
  if (signInA.error || !signInA.data.session) {
    record('jwt_user_a', 'BLOCKED', signInA.error?.message ?? 'no session')
    writeReportMd()
    process.exit(2)
  }
  const clientA = clientAsUser(url, anon, signInA.data.session.access_token)

  let ev1Before = await countProcedureCompletedEvents()
  record(
    'count_proc_completed_baseline_after_reset',
    ev1Before.error ? 'FAIL' : 'PASS',
    ev1Before.error ? ev1Before.error.message : String(ev1Before.n ?? 0),
  )

  const { data: rpc1, error: eRpc1 } = await clientA.rpc('complete_procedure_execution', {
    p_procedure_execution_id: execId,
  })

  let ev1After = await countProcedureCompletedEvents()

  if (eRpc1) {
    record(
      'rpc_user_a_first_completes',
      'FAIL',
      `${eRpc1.message}${eRpc1.hint ? ` hint=${eRpc1.hint}` : ''} — migrate 0012 applied?`,
    )
  } else if (
    !rpc1?.ok
    || rpc1.idempotent === true
    || rpc1.execution_status !== 'completed'
    || !rpc1.operational_event_id
  ) {
    record('rpc_user_a_first_completes', 'FAIL', JSON.stringify(rpc1 ?? null))
  } else {
    record(
      'rpc_user_a_first_completes',
      'PASS',
      `idempotent=${rpc1.idempotent} event=${rpc1.operational_event_id}`,
    )
  }

  const c1 =
    !ev1Before.error && !ev1After.error && typeof ev1After.n === 'number' && typeof ev1Before.n === 'number'
      ? ev1After.n - ev1Before.n
      : null
  record(
    'rpc_first_call_exactly_one_procedure_completed_row',
    c1 === 1 ? 'PASS' : 'FAIL',
    `delta=${String(c1)} before=${ev1Before.n ?? (ev1Before.error?.message ?? 'err')} after=${ev1After.n ?? (ev1After.error?.message ?? 'err')}`,
  )

  let ev2BeforeCount = await countProcedureCompletedEvents()
  const rpc1EventId = rpc1?.operational_event_id ?? null

  const { data: rpc2, error: eRpc2 } = await clientA.rpc('complete_procedure_execution', {
    p_procedure_execution_id: execId,
  })
  let ev2AfterCount = await countProcedureCompletedEvents()

  if (eRpc2) {
    record('rpc_user_a_second_idempotent', 'FAIL', eRpc2.message)
  } else if (
    !rpc2?.ok
    || rpc2.idempotent !== true
    || rpc2.operational_event_id !== rpc1EventId
    || rpc2.execution_status !== 'completed'
  ) {
    record('rpc_user_a_second_idempotent', 'FAIL', JSON.stringify(rpc2 ?? null))
  } else {
    record('rpc_user_a_second_idempotent', 'PASS', `event=${rpc2.operational_event_id}`)
  }

  const dupOk =
    !ev2BeforeCount.error
    && !ev2AfterCount.error
    && typeof ev2BeforeCount.n === 'number'
    && typeof ev2AfterCount.n === 'number'
    && ev2AfterCount.n === ev2BeforeCount.n
    && Boolean(rpc1EventId)

  record(
    'rpc_second_call_no_extra_procedure_completed',
    dupOk ? 'PASS' : 'FAIL',
    `same_count=${dupOk} n=${dupOk ? ev2AfterCount.n : ev2AfterCount.error?.message ?? ev2AfterCount.n}`,
  )

  if (userB?.id) {
    const anonB = createClient(url, anon)
    const siB = await anonB.auth.signInWithPassword({
      email: SYNTHETIC.userB.email,
      password: SYNTHETIC.userB.password,
    })
    if (!siB.error && siB.data.session) {
      const clientB = clientAsUser(url, anon, siB.data.session.access_token)
      const { data: rB } = await clientB.rpc('complete_procedure_execution', {
        p_procedure_execution_id: execId,
      })
      record(
        'rpc_user_b_cannot_complete_org_a_procedure',
        rB?.ok === false ? 'PASS' : 'FAIL',
        JSON.stringify(rB ?? null),
      )
    } else {
      record(
        'rpc_user_b_cannot_complete_org_a_procedure',
        'BLOCKED',
        siB.error?.message ?? 'no jwt',
      )
    }
  } else {
    record('rpc_user_b_cannot_complete_org_a_procedure', 'BLOCKED', 'User B absent')
  }

  const anonC = createClient(url, anon)
  const siC = await anonC.auth.signInWithPassword({
    email: SYNTHETIC.userC.email,
    password: SYNTHETIC.userC.password,
  })
  if (!siC.error && siC.data.session) {
    const clientC = clientAsUser(url, anon, siC.data.session.access_token)
    const { data: rC } = await clientC.rpc('complete_procedure_execution', {
      p_procedure_execution_id: execId,
    })
    record(
      'rpc_user_c_org_only_cannot_complete_no_study_membership',
      rC?.ok === false ? 'PASS' : 'FAIL',
      JSON.stringify(rC ?? null),
    )
  } else {
    record(
      'rpc_user_c_org_only_cannot_complete_no_study_membership',
      'BLOCKED',
      siC.error?.message ?? 'no jwt',
    )
  }

  writeReportMd()
  const exitCode = results.summary.failed > 0 ? 1 : results.summary.blocked > 0 ? 2 : 0
  console.log(
    `\nPhase 3B validation: ${results.summary.passed} pass, ${results.summary.failed} fail, ${results.summary.blocked} blocked`,
  )
  console.log('Report: docs/PHASE3B-VALIDATION-RESULTS.md')
  process.exit(exitCode)
}

main().catch((err) => {
  record('runtime', 'FAIL', String(err.message || err))
  writeReportMd()
  console.error(err)
  process.exit(1)
})
