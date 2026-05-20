/**
 * Staging-only — seed 3 VPI risk scenarios for Phase 7E visual QA.
 *
 * Requires: npm run db:provision (synthetic org/users) + at least one study in Org A.
 *
 * Usage: npm run db:seed-vpi-risk-scenarios
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

/** Must match scripts/provision-synthetic.mjs */
const SYNTHETIC = {
  orgAName: 'Synthetic Site Alpha (Staging)',
  userAEmail: 'synthetic.staff.a@vilo-os.staging',
}

const SEED = {
  subjectIdentifier: 'VPI-STAGING-RISK-01',
  visitDefMissed: { code: 'VPI_SEED_MISSED', label: 'VPI seed — missed visit' },
  visitDefHost: { code: 'VPI_SEED_HOST', label: 'VPI seed — blocked procedure host' },
  procedureDef: { code: 'VPI_SEED_BLOCKED', label: 'VPI seed — blocked procedure' },
  workflowTitle: '[VPI_SEED] Overdue coordinator action',
}

function daysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function assertStagingTarget(org) {
  if (!org?.name?.includes('Synthetic') || !org.name.includes('Staging')) {
    throw new Error(
      `Refusing to seed: organization "${org?.name ?? 'unknown'}" is not a synthetic staging org. ` +
        `Expected name like "${SYNTHETIC.orgAName}".`,
    )
  }
  if (process.env.VPI_SEED_ALLOW_ANY_ORG === 'true') return
}

async function requireRow(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  if (!data) {
    throw new Error(
      `${label}: not found. Run npm run db:provision and ensure at least one study exists in ${SYNTHETIC.orgAName}.`,
    )
  }
  return data
}

async function upsertVisitDefinition(admin, studyId, organizationId, spec) {
  const { data, error } = await admin
    .from('visit_definitions')
    .upsert(
      {
        organization_id: organizationId,
        study_id: studyId,
        code: spec.code,
        label: spec.label,
        sort_order: 9900,
      },
      { onConflict: 'study_id,code' },
    )
    .select('id, code')
    .single()
  if (error) throw new Error(`visit_definition ${spec.code}: ${error.message}`)
  return data
}

async function upsertProcedureDefinition(admin, studyId, organizationId, spec) {
  const { data, error } = await admin
    .from('procedure_definitions')
    .upsert(
      {
        organization_id: organizationId,
        study_id: studyId,
        code: spec.code,
        label: spec.label,
        is_required_default: true,
      },
      { onConflict: 'study_id,code' },
    )
    .select('id, code')
    .single()
  if (error) throw new Error(`procedure_definition ${spec.code}: ${error.message}`)
  return data
}

async function ensureVisit(admin, input) {
  const { data: existing, error: findErr } = await admin
    .from('visits')
    .select('id, visit_status')
    .eq('study_subject_id', input.studySubjectId)
    .eq('visit_definition_id', input.visitDefinitionId)
    .maybeSingle()
  if (findErr) throw new Error(`visit lookup: ${findErr.message}`)

  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    study_subject_id: input.studySubjectId,
    visit_definition_id: input.visitDefinitionId,
    scheduled_date: input.scheduledDate,
    visit_status: input.visitStatus,
    window_start: input.windowStart ?? null,
    window_end: input.windowEnd ?? null,
    window_status: input.windowStatus ?? 'inside_window',
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await admin
      .from('visits')
      .update(row)
      .eq('id', existing.id)
      .select('id, visit_status')
      .single()
    if (error) throw new Error(`visit update: ${error.message}`)
    return { id: data.id, visit_status: data.visit_status, created: false }
  }

  const { data, error } = await admin
    .from('visits')
    .insert({ ...row, created_at: new Date().toISOString() })
    .select('id, visit_status')
    .single()
  if (error) throw new Error(`visit insert: ${error.message}`)
  return { id: data.id, visit_status: data.visit_status, created: true }
}

async function ensureBlockedProcedure(admin, input) {
  const { data: existing, error: findErr } = await admin
    .from('procedure_executions')
    .select('id, validation_status')
    .eq('visit_id', input.visitId)
    .eq('procedure_definition_id', input.procedureDefinitionId)
    .maybeSingle()
  if (findErr) throw new Error(`procedure lookup: ${findErr.message}`)

  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    visit_id: input.visitId,
    procedure_definition_id: input.procedureDefinitionId,
    execution_status: 'in_progress',
    validation_status: 'blocked',
    performed_by_user_id: input.performedByUserId,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await admin
      .from('procedure_executions')
      .update(row)
      .eq('id', existing.id)
      .select('id, validation_status')
      .single()
    if (error) throw new Error(`procedure update: ${error.message}`)
    return { id: data.id, validation_status: data.validation_status, created: false }
  }

  const { data, error } = await admin
    .from('procedure_executions')
    .insert({ ...row, created_at: new Date().toISOString() })
    .select('id, validation_status')
    .single()
  if (error) throw new Error(`procedure insert: ${error.message}`)
  return { id: data.id, validation_status: data.validation_status, created: true }
}

async function ensureOverdueWorkflow(admin, input) {
  const { data: existing, error: findErr } = await admin
    .from('subject_workflow_actions')
    .select('id, status, due_date')
    .eq('study_id', input.studyId)
    .eq('study_subject_id', input.studySubjectId)
    .eq('title', SEED.workflowTitle)
    .maybeSingle()
  if (findErr) throw new Error(`workflow lookup: ${findErr.message}`)

  const row = {
    organization_id: input.organizationId,
    study_id: input.studyId,
    study_subject_id: input.studySubjectId,
    visit_id: input.visitId,
    action_type: 'follow_up',
    status: 'open',
    priority: 'high',
    title: SEED.workflowTitle,
    description: 'Staging-only VPI seed — overdue action for coordinator inbox validation.',
    due_date: daysAgo(2),
    created_by: input.createdByUserId,
    assigned_user_id: input.assignedUserId,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await admin
      .from('subject_workflow_actions')
      .update(row)
      .eq('id', existing.id)
      .select('id, status, due_date')
      .single()
    if (error) throw new Error(`workflow update: ${error.message}`)
    return { id: data.id, status: data.status, due_date: data.due_date, created: false }
  }

  const { data, error } = await admin
    .from('subject_workflow_actions')
    .insert({ ...row, created_at: new Date().toISOString() })
    .select('id, status, due_date')
    .single()
  if (error) throw new Error(`workflow insert: ${error.message}`)
  return { id: data.id, status: data.status, due_date: data.due_date, created: true }
}

async function countRiskSignals(admin, studyId) {
  const { count, error } = await admin
    .from('vpi_subject_risk_signals_v1')
    .select('signal_kind', { count: 'exact', head: true })
    .eq('study_id', studyId)
  if (error) {
    return { count: null, error: error.message }
  }
  return { count, error: null }
}

async function main() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const org = await requireRow(
    admin.from('organizations').select('id, name').eq('name', SYNTHETIC.orgAName).maybeSingle(),
    'Synthetic organization',
  )
  assertStagingTarget(org)

  const { data: studies, error: studiesErr } = await admin
    .from('studies')
    .select('id, name, status')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
    .limit(5)
  if (studiesErr) throw new Error(`studies: ${studiesErr.message}`)
  if (!studies?.length) {
    throw new Error(
      `No studies in ${SYNTHETIC.orgAName}. Create a study in staging before running VPI risk seed.`,
    )
  }
  const study = studies[0]

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 })
  const userA = listed?.users?.find((u) => u.email === SYNTHETIC.userAEmail)
  if (!userA) {
    throw new Error(`Synthetic user ${SYNTHETIC.userAEmail} not found. Run npm run db:provision first.`)
  }

  const { data: subject, error: subErr } = await admin
    .from('study_subjects')
    .upsert(
      {
        organization_id: org.id,
        study_id: study.id,
        subject_identifier: SEED.subjectIdentifier,
        enrollment_status: 'enrolled',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'study_id,subject_identifier' },
    )
    .select('id, subject_identifier')
    .single()
  if (subErr) throw new Error(`study_subject: ${subErr.message}`)

  const visitDefMissed = await upsertVisitDefinition(
    admin,
    study.id,
    org.id,
    SEED.visitDefMissed,
  )
  const visitDefHost = await upsertVisitDefinition(admin, study.id, org.id, SEED.visitDefHost)
  const procedureDef = await upsertProcedureDefinition(
    admin,
    study.id,
    org.id,
    SEED.procedureDef,
  )

  const missedVisit = await ensureVisit(admin, {
    organizationId: org.id,
    studyId: study.id,
    studySubjectId: subject.id,
    visitDefinitionId: visitDefMissed.id,
    scheduledDate: daysAgo(14),
    visitStatus: 'missed',
    windowStart: daysAgo(21),
    windowEnd: daysAgo(7),
    windowStatus: 'inside_window',
  })

  const hostVisit = await ensureVisit(admin, {
    organizationId: org.id,
    studyId: study.id,
    studySubjectId: subject.id,
    visitDefinitionId: visitDefHost.id,
    scheduledDate: daysAgo(3),
    visitStatus: 'in_progress',
    windowStart: daysAgo(5),
    windowEnd: daysAgo(1),
    windowStatus: 'inside_window',
  })

  const blockedProcedure = await ensureBlockedProcedure(admin, {
    organizationId: org.id,
    studyId: study.id,
    visitId: hostVisit.id,
    procedureDefinitionId: procedureDef.id,
    performedByUserId: userA.id,
  })

  const overdueWorkflow = await ensureOverdueWorkflow(admin, {
    organizationId: org.id,
    studyId: study.id,
    studySubjectId: subject.id,
    visitId: hostVisit.id,
    createdByUserId: userA.id,
    assignedUserId: userA.id,
  })

  const signalCheck = await countRiskSignals(admin, study.id)

  const summary = {
    runAt: new Date().toISOString(),
    stagingOnly: true,
    organization: { id: org.id, name: org.name },
    study: { id: study.id, name: study.name },
    subject: { id: subject.id, subject_identifier: subject.subject_identifier },
    scenarios: {
      missed_visit: {
        visit_id: missedVisit.id,
        visit_status: missedVisit.visit_status,
        signal_kind: 'missed_visit',
        created: missedVisit.created,
      },
      blocked_procedure: {
        procedure_execution_id: blockedProcedure.id,
        validation_status: blockedProcedure.validation_status,
        host_visit_id: hostVisit.id,
        created: blockedProcedure.created,
      },
      overdue_workflow: {
        workflow_action_id: overdueWorkflow.id,
        due_date: overdueWorkflow.due_date,
        title: SEED.workflowTitle,
        created: overdueWorkflow.created,
      },
    },
    vpi_subject_risk_signals_for_study: signalCheck.count,
    vpi_view_query_error: signalCheck.error,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (signalCheck.count === 0) {
    console.error(
      '\nSeed rows written but vpi_subject_risk_signals_v1 still shows 0 rows for this study. ' +
        'Check migration 0053 and view predicates.',
    )
    process.exit(1)
  }

  console.log(
    `\nVPI risk seed OK — ${signalCheck.count} signal row(s) visible for study ${study.name}.`,
  )
  console.log('Next: npm run db:validate-phase7a-staging-snapshot && npm run dev → /performance/today')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
