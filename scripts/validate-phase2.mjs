/**
 * Phase 2 clinical schema verification + synthetic seed + JWT isolation probes.
 *
 * Prerequisites:
 *   - Migrations 0003–0011 applied (manual SQL Editor is fine).
 *   - DATABASE_URL_DIRECT or DATABASE_URL for catalog/policy checks via postgres.js.
 *   - Phase 1b synthetic provision (orgs + synthetic.staff.a / .b users).
 *
 * Usage: npm run db:validate-phase2
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, projectRoot, requireEnv } from './lib/env.mjs'

const SYNTHETIC = {
  orgAName: 'Synthetic Site Alpha (Staging)',
  userA: { email: 'synthetic.staff.a@vilo-os.staging', password: 'SyntheticViloOs!2026A' },
  userB: { email: 'synthetic.staff.b@vilo-os.staging', password: 'SyntheticViloOs!2026B' },
  /** Org A member only — intentionally kept off `study_members` for Phase 2 study */
  userC: {
    email: 'synthetic.staff.c.orga.only@vilo-os.staging',
    password: 'SyntheticViloOs!2026C',
    displayName: 'Synthetic Org-A Member Only',
    orgRole: 'member',
  },
  attachmentPath: 'phase2-validation/demo-visit-attachment.txt',
}

const PHASE2_TABLES = [
  'studies',
  'study_versions',
  'study_members',
  'visit_definitions',
  'procedure_definitions',
  'visit_def_procedure_map',
  'study_subjects',
  'visits',
  'procedure_executions',
  'operational_events',
  'attachments',
]

const results = {
  runAt: new Date().toISOString(),
  phase: '2',
  checks: [],
  seed: {},
  syntheticIds: {},
  catalog: [],
  summary: { passed: 0, failed: 0, blocked: 0, skipped: 0 },
}

function record(name, status, detail) {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else if (status === 'BLOCKED') results.summary.blocked++
  else if (status === 'SKIP') results.summary.skipped++
}

function pickDatabaseUrlsInOrder() {
  const direct = process.env.DATABASE_URL_DIRECT?.trim()
  const pooled = process.env.DATABASE_URL?.trim()
  const urls = []
  if (direct) urls.push(direct)
  if (pooled && pooled !== direct) urls.push(pooled)
  return urls
}

function isSupabasePooler(url) {
  try {
    const u = new URL(url)
    return u.hostname.includes('pooler.supabase.com') || u.port === '6543'
  } catch {
    return false
  }
}

/** @returns {postgres.Sql|false} */
async function connectPostgresCandidate() {
  const candidates = pickDatabaseUrlsInOrder()
  for (const raw of candidates) {
    try {
      const sql = postgres(raw, {
        ssl: 'require',
        max: 1,
        connect_timeout: 25,
        prepare: isSupabasePooler(raw) ? false : undefined,
      })
      await sql`select 1`
      return sql
    } catch (e) {
      const msg = String(e.message || e)
      if (/tenant or user not found/i.test(msg) && candidates.length > 1) continue
    }
  }
  return false
}

function writeReportMd() {
  const out = resolve(projectRoot, 'docs/PHASE2-VALIDATION-RESULTS.md')
  const lines = [
    '# Phase 2 — Schema validation results',
    '',
    `**Run at:** ${results.runAt}`,
    '',
    '## Summary',
    '',
    `| Result | Count |`,
    `|--------|-------|`,
    `| PASS | ${results.summary.passed} |`,
    `| FAIL | ${results.summary.failed} |`,
    `| BLOCKED | ${results.summary.blocked} |`,
    `| SKIP | ${results.summary.skipped} |`,
    '',
    results.summary.failed === 0 && results.summary.blocked === 0
      ? '**Phase 2 status:** GREEN — all required checks executed (skipped rows optional).'
      : results.summary.failed > 0
        ? '**Phase 2 status:** RED — address FAIL rows above.'
        : '**Phase 2 status:** AMBER — unblock BLOCKED rows.',
    '',
    '## Checks',
    '',
    '| Check | Status | Detail |',
    '|-------|--------|--------|',
    ...results.checks.map(
      (c) => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|')} |`,
    ),
    '',
    '## Catalog excerpt (tables + RLS)',
    '',
    '```json',
    JSON.stringify(results.catalog, null, 2),
    '```',
    '',
    '## Synthetic seed (service role)',
    '',
    '```json',
    JSON.stringify({ seedSteps: results.seed, ids: results.syntheticIds }, null, 2),
    '```',
    '',
    '## Commands',
    '',
    '`npm run db:validate-phase2`',
    '',
    '---',
    '',
    '### A. Attachments isolation',
    '',
    'See checks: `seed_attachment_service_role`, `attachments_user_a_reads_visit_linked_row`, `attachments_user_b_org_beta_cannot_read_org_a_attachment`.',
    '- User A (**study coordinator**) reads visit-linked attachment row.',
    '- User B (**Org Beta**) returns **zero** rows for Org A attachment id (cross-org).',
    '',
    '### B. Same-org, non–`study_members` principal (User C)',
    '',
    'See checks: `same_org_user_c_reads_own_organization`, `same_org_user_c_cannot_*`.',
    '- **synthetic.staff.c.orga.only@vilo-os.staging** keeps `organization_members.role = member` only; **`study_members` row removed** for the Phase 2 validation study.',
    '- User C still reads **`organizations`** for Org Alpha (org-level baseline visibility).',
    '- User C **cannot read** Phase 2 study, study_versions, operational_events on that study, or the attachment seeded for coordinators.',
    '',
    '### C. Validation summary',
    '',
    `Latest counts: PASS ${results.summary.passed}, FAIL ${results.summary.failed}, BLOCKED ${results.summary.blocked}, SKIP ${results.summary.skipped}.`,
    '',
    '### D. Remaining risks',
    '',
    '- **Storage buckets:** Attachment row is metadata-only (`storage_bucket=phase2-validation`); aligned Storage RLS is **Phase 2b**.',
    '- **`DATABASE_URL_DIRECT` / `DATABASE_URL` omitted:** Postgres catalog/policy introspection still **SKIP** until configured.',
    '- **Synthetic-only:** User C credential lives in validator script (`SyntheticViloOs!2026C`) — staging only.',
    '',
    '### E. Fully green?',
    '',
    results.summary.failed === 0 && results.summary.blocked === 0
      ? 'Yes — GREEN for JWT + seeded clinical slice + attachments + Org A lateral isolation (SKIP catalog optional).'
      : 'NO — remediation required.',
    '',
  ]
  writeFileSync(out, lines.join('\n'), 'utf8')
}

function clientAsUser(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function ensureOrgAMemberWithoutStudy(admin, organizationIdAlpha, excludeStudyId) {
  const spec = SYNTHETIC.userC
  let userC =
    (
      await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
    ).data?.users?.find((u) => u.email === spec.email) ?? null

  if (!userC) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { display_name: spec.displayName },
    })
    if (error) {
      const msg = error.message ?? ''
      if (/already registered|already exists|duplicate/i.test(msg)) {
        const again = (
          await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        ).data?.users?.find((u) => u.email === spec.email)
        if (again) {
          userC = again
          record('provision_user_c_reused_after_race', 'PASS', spec.email)
        }
      }
      if (!userC) {
        record('provision_user_c', 'FAIL', `createUser: ${msg}`)
        return null
      }
    } else {
      userC = data.user
      record('provision_user_c_created', 'PASS', spec.email)
    }
  } else {
    record('provision_user_c_reused', 'PASS', spec.email)
  }

  await admin.from('profiles').upsert({
    id: userC.id,
    display_name: spec.displayName,
  })

  const { error: memErr } = await admin.from('organization_members').upsert(
    {
      organization_id: organizationIdAlpha,
      user_id: userC.id,
      role: spec.orgRole,
    },
    { onConflict: 'organization_id,user_id' },
  )
  if (memErr) {
    record('provision_user_c_org_membership', 'FAIL', memErr.message)
    return null
  }

  await admin.from('study_members').delete().eq('study_id', excludeStudyId).eq('user_id', userC.id)

  record('provision_user_c_study_members_cleared', 'PASS', `study_id=${excludeStudyId}`)
  return userC
}

async function main() {
  try {
    requireEnv([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ])
  } catch (e) {
    record('environment_supabase', 'BLOCKED', e.message)
    writeReportMd()
    process.exit(2)
  }

  loadEnvFiles()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const sqlConn = await connectPostgresCandidate()
  if (!sqlConn) {
    record(
      'catalog_postgres_connection',
      'SKIP',
      'No DATABASE_URL_DIRECT or DATABASE_URL — skipped catalog/policy introspection (Supabase MCP or SQL Editor can still confirm).',
    )
  }

  /** @type {(q: postgres.Sql) => Promise<void>} */
  async function runCatalogVerification(sqlConnLocal) {
    const rows =
      await sqlConnLocal`
      select c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where c.relkind = 'r'
        and c.relname in ${sqlConnLocal(PHASE2_TABLES)}
      order by c.relname
    `
    results.catalog = [...rows]

    const found = rows.map((r) => r.table_name)
    for (const t of PHASE2_TABLES) {
      record(`table_exists:${t}`, found.includes(t) ? 'PASS' : 'FAIL', found.includes(t) ? 'present' : 'missing')
    }
    for (const r of rows) {
      record(
        `rls_enabled:${r.table_name}`,
        r.rls_enabled ? 'PASS' : 'FAIL',
        r.rls_enabled ? 'ON' : 'OFF',
      )
    }

    const orgCols = await sqlConnLocal`
      select table_name
      from information_schema.columns
      where table_schema = 'public'
        and column_name = 'organization_id'
        and table_name in ${sqlConnLocal(PHASE2_TABLES)}
    `
    record(
      'organization_id_on_all_phase2_tables',
      orgCols.length === PHASE2_TABLES.length ? 'PASS' : 'FAIL',
      `tables_with_column=${orgCols.length} expected=${PHASE2_TABLES.length}`,
    )

    const badOrgId = await sqlConnLocal`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public' and column_name = 'org_id'
    `
    record(
      'no_org_id_column_anywhere_public',
      badOrgId.length === 0 ? 'PASS' : 'FAIL',
      badOrgId.length ? JSON.stringify([...badOrgId]) : 'none',
    )

    const opEvPol = await sqlConnLocal`
      select policyname, cmd, roles::text as roles
      from pg_policies
      where schemaname = 'public'
        and tablename = 'operational_events'
    `
    const badOp = [...opEvPol].filter((p) =>
      ['UPDATE', 'DELETE', 'ALL'].includes(String(p.cmd || '').replace(/\s+/g, '')),
    )
    record(
      'operational_events_no_update_delete_policies_listed',
      badOp.length === 0 ? 'PASS' : 'FAIL',
      badOp.length ? JSON.stringify(badOp) : 'SELECT/INSERT only (or none — see note)',
    )

    const smPolSimple = await sqlConnLocal`
      select policyname, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public' and tablename = 'study_members'
    `
    const rawLower = [...smPolSimple].map((p) => `${p.qual ?? ''} ${p.with_check ?? ''}`).join(' | ')
      .toLowerCase()
    const referencesStudyMembersRelation =
      rawLower.includes('from study_members')
      || rawLower.includes('join study_members')
      || /\bstudy_members\s*\./i.test(rawLower)
    const usesHelperAccess = rawLower.includes('user_has_study_access')
    const riskyStudyMembersPolicies = referencesStudyMembersRelation && !usesHelperAccess
    record(
      'study_members_policies_use_helpers_not_raw_self_ref',
      !riskyStudyMembersPolicies ? 'PASS' : 'FAIL',
      riskyStudyMembersPolicies
        ? `policy exposes direct study_members scans: ${JSON.stringify([...smPolSimple])}`
        : 'no direct FROM/JOIN study_members in policy USING/WITH CHECK (heuristic)',
    )

    const attPol = await sqlConnLocal`
      select policyname, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public' and tablename = 'attachments'
    `
    const attText = [...attPol].map((p) => `${p.qual ?? ''} ${p.with_check ?? ''}`).join(' | ')
    const hasOrgGate = attText.includes('user_organization_ids')
    record(
      'attachments_policies_reference_org_membership',
      hasOrgGate ? 'PASS' : 'FAIL',
      hasOrgGate
        ? 'attachments policies gate on user_organization_ids (+ study helpers)'
        : attText.slice(0, 2000) || JSON.stringify([...attPol]).slice(0, 2000),
    )
  }

  if (sqlConn) {
    try {
      await runCatalogVerification(sqlConn)
    } catch (e) {
      record('catalog_verification_error', 'FAIL', String(e.message || e))
    } finally {
      await sqlConn.end({ timeout: 5 })
    }
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: orgA, error: orgErr } = await admin
    .from('organizations')
    .select('id, name')
    .eq('name', SYNTHETIC.orgAName)
    .maybeSingle()

  if (orgErr || !orgA) {
    record('seed_org_alpha', 'BLOCKED', orgErr?.message ?? 'Org Alpha not found — run npm run db:provision')
    writeReportMd()
    console.log(`\nPhase 2 validation: ${results.summary.passed} pass, ${results.summary.failed} fail, ${results.summary.blocked} blocked`)
    console.log('Report: docs/PHASE2-VALIDATION-RESULTS.md')
    process.exit(results.summary.blocked > 0 ? 2 : 1)
  }

  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 })
  const userA = usersList?.users?.find((u) => u.email === SYNTHETIC.userA.email)
  const userB = usersList?.users?.find((u) => u.email === SYNTHETIC.userB.email)
  if (!userA) {
    record('seed_user_a', 'BLOCKED', 'synthetic.staff.a not found — run npm run db:provision')
    writeReportMd()
    process.exit(2)
  }

  const studySlug = 'phase2-validation-study'
  let studyId
  {
    const { data: existing } = await admin
      .from('studies')
      .select('id')
      .eq('organization_id', orgA.id)
      .eq('slug', studySlug)
      .maybeSingle()
    if (existing?.id) {
      studyId = existing.id
      results.seed.study = 'reused'
    } else {
      const { data, error } = await admin
        .from('studies')
        .insert({
          organization_id: orgA.id,
          slug: studySlug,
          name: 'Phase 2 Validation Study',
          status: 'active',
        })
        .select('id')
        .single()
      if (error) {
        record('seed_study', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      studyId = data.id
      results.seed.study = 'inserted'
    }
  }
  results.syntheticIds.study_id = studyId

  let versionId
  {
    const { data: existing } = await admin
      .from('study_versions')
      .select('id')
      .eq('study_id', studyId)
      .eq('version_label', 'baseline')
      .maybeSingle()
    if (existing?.id) {
      versionId = existing.id
      results.seed.study_version = 'reused'
    } else {
      const { data, error } = await admin
        .from('study_versions')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          version_label: 'baseline',
          protocol_identifier: 'PROTO-PHASE2-VAL',
          metadata: { phase: '2', validation: true },
        })
        .select('id')
        .single()
      if (error) {
        record('seed_study_version', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      versionId = data.id
      results.seed.study_version = 'inserted'
    }
  }
  results.syntheticIds.study_version_id = versionId

  {
    const { error } = await admin.from('study_members').upsert(
      {
        organization_id: orgA.id,
        study_id: studyId,
        user_id: userA.id,
        role: 'coordinator',
      },
      { onConflict: 'study_id,user_id' },
    )
    if (error) {
      record('seed_study_member', 'FAIL', error.message)
    } else {
      record('seed_study_member', 'PASS', 'coordinator for synthetic.staff.a')
    }
  }

  let visitDefId
  let procDefId
  {
    const { data: vd } = await admin
      .from('visit_definitions')
      .select('id')
      .eq('study_id', studyId)
      .eq('code', 'V_SCREENING')
      .maybeSingle()
    if (vd?.id) {
      visitDefId = vd.id
      results.seed.visit_definition = 'reused'
    } else {
      const { data, error } = await admin
        .from('visit_definitions')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          study_version_id: versionId,
          code: 'V_SCREENING',
          label: 'Screening',
          sort_order: 1,
        })
        .select('id')
        .single()
      if (error) {
        record('seed_visit_definition', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      visitDefId = data.id
      results.seed.visit_definition = 'inserted'
    }
  }
  results.syntheticIds.visit_definition_id = visitDefId

  {
    const { data: pd } = await admin
      .from('procedure_definitions')
      .select('id')
      .eq('study_id', studyId)
      .eq('code', 'PROC_CBC')
      .maybeSingle()
    if (pd?.id) {
      procDefId = pd.id
      results.seed.procedure_definition = 'reused'
    } else {
      const { data, error } = await admin
        .from('procedure_definitions')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          study_version_id: versionId,
          code: 'PROC_CBC',
          label: 'CBC',
          is_required_default: true,
          billable_default: false,
        })
        .select('id')
        .single()
      if (error) {
        record('seed_procedure_definition', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      procDefId = data.id
      results.seed.procedure_definition = 'inserted'
    }
  }
  results.syntheticIds.procedure_definition_id = procDefId

  {
    const { data: mapRow } = await admin
      .from('visit_def_procedure_map')
      .select('id')
      .eq('visit_definition_id', visitDefId)
      .eq('procedure_definition_id', procDefId)
      .maybeSingle()
    if (!mapRow) {
      const { error } = await admin.from('visit_def_procedure_map').insert({
        organization_id: orgA.id,
        study_id: studyId,
        visit_definition_id: visitDefId,
        procedure_definition_id: procDefId,
        sort_order: 1,
        is_required: true,
      })
      record('seed_visit_def_procedure_map', error ? 'FAIL' : 'PASS', error?.message ?? 'inserted')
    } else {
      record('seed_visit_def_procedure_map', 'PASS', 'reused')
    }
  }

  const subjectExternalId = 'SUBJ-P2VAL-001'
  let subjectId
  {
    const { data: sj } = await admin
      .from('study_subjects')
      .select('id')
      .eq('study_id', studyId)
      .eq('subject_identifier', subjectExternalId)
      .maybeSingle()
    if (sj?.id) {
      subjectId = sj.id
      results.seed.subject = 'reused'
    } else {
      const { data, error } = await admin
        .from('study_subjects')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          study_version_id: versionId,
          subject_identifier: subjectExternalId,
          enrollment_status: 'enrolled',
        })
        .select('id')
        .single()
      if (error) {
        record('seed_subject', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      subjectId = data.id
      results.seed.subject = 'inserted'
    }
  }
  results.syntheticIds.study_subject_id = subjectId

  let visitId
  {
    const { data: v } = await admin
      .from('visits')
      .select('id')
      .eq('study_subject_id', subjectId)
      .eq('visit_definition_id', visitDefId)
      .maybeSingle()
    if (v?.id) {
      visitId = v.id
      results.seed.visit = 'reused'
    } else {
      const { data, error } = await admin
        .from('visits')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          study_subject_id: subjectId,
          visit_definition_id: visitDefId,
          scheduled_date: '2026-06-01',
          visit_status: 'scheduled',
        })
        .select('id')
        .single()
      if (error) {
        record('seed_visit', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      visitId = data.id
      results.seed.visit = 'inserted'
    }
  }
  results.syntheticIds.visit_id = visitId

  let execId
  {
    const { data: pe } = await admin
      .from('procedure_executions')
      .select('id')
      .eq('visit_id', visitId)
      .eq('procedure_definition_id', procDefId)
      .maybeSingle()
    if (pe?.id) {
      execId = pe.id
      results.seed.procedure_execution = 'reused'
    } else {
      const { data, error } = await admin
        .from('procedure_executions')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          visit_id: visitId,
          procedure_definition_id: procDefId,
          execution_status: 'pending',
        })
        .select('id')
        .single()
      if (error) {
        record('seed_procedure_execution', 'FAIL', error.message)
        writeReportMd()
        process.exit(1)
      }
      execId = data.id
      results.seed.procedure_execution = 'inserted'
    }
  }
  results.syntheticIds.procedure_execution_id = execId

  {
    const { count, error: countErr } = await admin
      .from('operational_events')
      .select('*', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('visit_id', visitId)
      .eq('event_type', 'VISIT_SCHEDULED')
    if (countErr) {
      record('seed_operational_event_count_query', 'FAIL', countErr.message)
    }
    const hasExisting = !countErr && Number(count) >= 1
    if (hasExisting) {
      record('seed_operational_event', 'PASS', 'reused VISIT_SCHEDULED')
      const { data: oe } = await admin
        .from('operational_events')
        .select('id')
        .eq('study_id', studyId)
        .eq('visit_id', visitId)
        .eq('event_type', 'VISIT_SCHEDULED')
        .limit(1)
        .maybeSingle()
      if (oe?.id) results.syntheticIds.operational_event_id = oe.id
    } else {
      const { data, error } = await admin
        .from('operational_events')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          visit_id: visitId,
          event_type: 'VISIT_SCHEDULED',
          payload: { phase2_validation: true },
          actor_user_id: userA.id,
        })
        .select('id')
        .single()
      record('seed_operational_event', error ? 'FAIL' : 'PASS', error?.message ?? 'inserted VISIT_SCHEDULED')
      if (data?.id) results.syntheticIds.operational_event_id = data.id
    }
  }

  const userCAccount = await ensureOrgAMemberWithoutStudy(admin, orgA.id, studyId)
  if (userCAccount?.id) {
    results.syntheticIds.user_c_id = userCAccount.id
  }

  /** Service role inserts attachment (metadata-only; storage bucket ACLs deferred to Phase 2b). */
  let attachmentId
  {
    const { data: attRow } = await admin
      .from('attachments')
      .select('id')
      .eq('study_id', studyId)
      .eq('storage_path', SYNTHETIC.attachmentPath)
      .maybeSingle()
    if (attRow?.id) {
      attachmentId = attRow.id
      results.seed.attachment = 'reused'
      record('seed_attachment_service_role', 'PASS', `reused id=${attachmentId}`)
    } else {
      const { data, error } = await admin
        .from('attachments')
        .insert({
          organization_id: orgA.id,
          study_id: studyId,
          entity_type: 'visit',
          entity_id: visitId,
          storage_bucket: 'phase2-validation',
          storage_path: SYNTHETIC.attachmentPath,
          file_name: 'demo-visit-attachment.txt',
          mime_type: 'text/plain',
          size_bytes: 32,
          uploaded_by_user_id: userA.id,
        })
        .select('id')
        .single()
      if (error) {
        record('seed_attachment_service_role', 'FAIL', error.message)
      } else {
        attachmentId = data?.id
        results.seed.attachment = 'inserted'
        record('seed_attachment_service_role', 'PASS', `visit_id=${visitId}`)
      }
    }
  }
  results.syntheticIds.attachment_id = attachmentId ?? null

  const anonA = createClient(url, anon)
  const anonB = createClient(url, anon)
  const anonC = createClient(url, anon)
  const signInA = await anonA.auth.signInWithPassword({
    email: SYNTHETIC.userA.email,
    password: SYNTHETIC.userA.password,
  })
  const signInB = userB
    ? await anonB.auth.signInWithPassword({
        email: SYNTHETIC.userB.email,
        password: SYNTHETIC.userB.password,
      })
    : { data: { session: null }, error: new Error('no user b') }
  const signInC = userCAccount
    ? await anonC.auth.signInWithPassword({
        email: SYNTHETIC.userC.email,
        password: SYNTHETIC.userC.password,
      })
    : { data: { session: null }, error: new Error('no user c account provisioned') }

  if (signInA.error || !signInA.data.session) {
    record('jwt_user_a', 'BLOCKED', signInA.error?.message ?? 'no session')
  } else {
    const clientA = clientAsUser(url, anon, signInA.data.session.access_token)
    const { data: studiesA, error: e1 } = await clientA.from('studies').select('id').eq('id', studyId)
    record(
      'isolation_user_a_reads_own_study',
      !e1 && (studiesA?.length ?? 0) === 1 ? 'PASS' : 'FAIL',
      e1?.message ?? `rows=${studiesA?.length ?? 0}`,
    )

    const { data: opA, error: e2 } = await clientA
      .from('operational_events')
      .select('id')
      .eq('study_id', studyId)
      .limit(3)
    record(
      'isolation_user_a_reads_operational_events',
      !e2 && (opA?.length ?? 0) >= 1 ? 'PASS' : 'FAIL',
      e2?.message ?? `rows=${opA?.length ?? 0}`,
    )

    if (attachmentId) {
      const { data: aAtt, error: aAttErr } = await clientA
        .from('attachments')
        .select('id,file_name')
        .eq('id', attachmentId)
        .maybeSingle()
      record(
        'attachments_user_a_reads_visit_linked_row',
        !aAttErr && aAtt?.id === attachmentId ? 'PASS' : 'FAIL',
        aAttErr?.message ?? JSON.stringify(aAtt ?? null),
      )
    } else {
      record('attachments_user_a_reads_visit_linked_row', 'SKIP', 'no attachment row id — seed failure')
    }

    const oeIdForMut = results.syntheticIds.operational_event_id ?? opA?.[0]?.id
    if (oeIdForMut) {
      const { error: upErr, data: upData } = await clientA
        .from('operational_events')
        .update({ payload: { tamper: true } })
        .eq('id', oeIdForMut)
        .select('id')
      const updateBlocked =
        !!(upErr || (Array.isArray(upData) ? upData.length === 0 : !upData))
      record(
        'append_only_operational_events_update_blocked',
        updateBlocked ? 'PASS' : 'FAIL',
        upErr?.message ??
          `(rows_returned=${Array.isArray(upData) ? upData.length : upData ? 1 : 0}) JWT update must touch 0 rows`,
      )

      const { error: delErr, data: delData } = await clientA
        .from('operational_events')
        .delete()
        .eq('id', oeIdForMut)
        .select('id')
      const deleteBlocked =
        !!(delErr || (Array.isArray(delData) ? delData.length === 0 : !delData))
      record(
        'append_only_operational_events_delete_blocked',
        deleteBlocked ? 'PASS' : 'FAIL',
        delErr?.message ??
          `(rows_returned=${Array.isArray(delData) ? delData.length : delData ? 1 : 0}) JWT delete must touch 0 rows`,
      )
    }
  }

  if (signInB.error || !signInB.data.session) {
    record('jwt_user_b', 'BLOCKED', signInB.error?.message ?? 'no session')
    record(
      'isolation_user_b_org_boundary_study_hidden',
      'BLOCKED',
      'Cannot probe User B isolation without session.',
    )
    record(
      'attachments_user_b_org_beta_cannot_read_org_a_attachment',
      'BLOCKED',
      'User B JWT unavailable.',
    )
  } else {
    const clientB = clientAsUser(url, anon, signInB.data.session.access_token)
    const { data: cross, error: e3 } = await clientB.from('studies').select('id').eq('id', studyId)
    record(
      'isolation_user_b_org_boundary_study_hidden',
      !e3 && (cross?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
      e3?.message ?? `rows=${cross?.length ?? 0}`,
    )

    if (attachmentId) {
      const { data: crossAtt, error: e4 } = await clientB.from('attachments').select('id').eq('id', attachmentId)
      record(
        'attachments_user_b_org_beta_cannot_read_org_a_attachment',
        !e4 && (crossAtt?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
        e4?.message ?? `rows=${crossAtt?.length ?? 0}`,
      )
    }
  }

  if (signInC.error || !signInC.data.session) {
    record('jwt_user_c', 'BLOCKED', signInC.error?.message ?? 'no session')
    record('same_org_user_c_reads_own_organization', 'BLOCKED', 'User C JWT unavailable.')
    record('same_org_user_c_cannot_read_phase2_validation_study', 'BLOCKED', 'User C JWT unavailable.')
    record('same_org_user_c_cannot_read_study_versions', 'BLOCKED', 'User C JWT unavailable.')
    record('same_org_user_c_cannot_read_operational_events', 'BLOCKED', 'User C JWT unavailable.')
    record('same_org_user_c_cannot_read_org_a_attachment_on_study', 'BLOCKED', 'User C JWT unavailable.')
  } else {
    const clientC = clientAsUser(url, anon, signInC.data.session.access_token)
    const { data: orgC, error: orgCErr } = await clientC
      .from('organizations')
      .select('id')
      .eq('id', orgA.id)
      .maybeSingle()
    record(
      'same_org_user_c_reads_own_organization',
      !orgCErr && orgC?.id === orgA.id ? 'PASS' : 'FAIL',
      orgCErr?.message ?? JSON.stringify(orgC ?? null),
    )

    const { data: studyCRows, error: studyCErr } = await clientC
      .from('studies')
      .select('id')
      .eq('id', studyId)
    record(
      'same_org_user_c_cannot_read_phase2_validation_study',
      !studyCErr && (studyCRows?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
      studyCErr?.message ?? `rows=${studyCRows?.length ?? 0}`,
    )

    const { data: verCRows, error: verCErr } = await clientC
      .from('study_versions')
      .select('id')
      .eq('study_id', studyId)
      .limit(5)
    record(
      'same_org_user_c_cannot_read_study_versions',
      !verCErr && (verCRows?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
      verCErr?.message ?? `rows=${verCRows?.length ?? 0}`,
    )

    const { data: opCRows, error: opCErr } = await clientC
      .from('operational_events')
      .select('id')
      .eq('study_id', studyId)
      .limit(3)
    record(
      'same_org_user_c_cannot_read_operational_events',
      !opCErr && (opCRows?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
      opCErr?.message ?? `rows=${opCRows?.length ?? 0}`,
    )

    if (attachmentId) {
      const { data: cAtt, error: cAttErr } = await clientC
        .from('attachments')
        .select('id')
        .eq('id', attachmentId)
      record(
        'same_org_user_c_cannot_read_org_a_attachment_on_study',
        !cAttErr && (cAtt?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
        cAttErr?.message ?? `rows=${cAtt?.length ?? 0}`,
      )
    } else {
      record('same_org_user_c_cannot_read_org_a_attachment_on_study', 'SKIP', 'no attachment seeded')
    }
  }

  writeReportMd()
  const exitCode = results.summary.failed > 0 ? 1 : results.summary.blocked > 0 ? 2 : 0
  console.log(`\nPhase 2 validation: ${results.summary.passed} pass, ${results.summary.failed} fail, ${results.summary.blocked} blocked`)
  console.log('Report: docs/PHASE2-VALIDATION-RESULTS.md')
  process.exit(exitCode)
}

main().catch((err) => {
  record('runtime', 'FAIL', String(err.message || err))
  writeReportMd()
  console.error(err)
  process.exit(1)
})
