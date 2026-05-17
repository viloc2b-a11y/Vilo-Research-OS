/**
 * Phase 6B.1 / 6B.1B — Pathology + medication library schema and bulk seed checks.
 *
 * Usage: npm run db:validate-phase6b1-patient-libraries
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const LIBRARY_TABLES = [
  'pathology_library',
  'medication_library',
  'pathology_medication_links',
]

const SUBJECT_TABLES = ['subject_medical_history', 'subject_concomitant_medications']

const EXPECTED_INDEXES = [
  { table: 'pathology_library', name: 'pathology_library_common_name_idx' },
  { table: 'pathology_library', name: 'pathology_library_medical_name_idx' },
  { table: 'pathology_library', name: 'pathology_library_icd10_code_idx' },
  { table: 'pathology_library', name: 'pathology_library_system_idx' },
  { table: 'pathology_library', name: 'pathology_library_common_name_trgm_idx' },
  { table: 'pathology_library', name: 'pathology_library_synonyms_trgm_idx' },
  { table: 'medication_library', name: 'medication_library_medication_name_idx' },
  { table: 'medication_library', name: 'medication_library_brand_name_idx' },
  { table: 'medication_library', name: 'medication_library_drug_class_idx' },
  { table: 'subject_medical_history', name: 'subject_medical_history_org_subject_idx' },
  {
    table: 'subject_concomitant_medications',
    name: 'subject_concomitant_medications_org_subject_idx',
  },
]

const results = {
  runAt: new Date().toISOString(),
  phase: '6B.1B',
  checks: [],
  summary: { passed: 0, failed: 0, blocked: 0 },
}

function record(name, status, detail) {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else if (status === 'BLOCKED') results.summary.blocked++
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

async function connectPostgres() {
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
    } catch {
      /* try next */
    }
  }
  return null
}

function reportLines(title) {
  return [
    `# ${title}`,
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
      ? '**Overall:** GREEN'
      : results.summary.blocked > 0
        ? '**Overall:** BLOCKED — apply migrations / run seed script'
        : '**Overall:** FAIL — see checks below',
    '',
    '## Checks',
    '',
    '| Name | Status | Detail |',
    '|------|--------|--------|',
    ...results.checks.map((c) => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|')} |`),
    '',
  ]
}

function writeReportMd() {
  writeFileSync(
    resolve(projectRoot, 'docs/PHASE6B1-PATIENT-LIBRARIES-VALIDATION.md'),
    reportLines('Phase 6B.1 — Patient libraries validation').join('\n'),
    'utf8',
  )
  writeFileSync(
    resolve(projectRoot, 'docs/PHASE6B1B-BULK-SEED-VALIDATION.md'),
    [
      ...reportLines('Phase 6B.1B — Bulk seed validation (repo DOCX sources)'),
      '## Seed command',
      '',
      '```bash',
      'npm run db:seed-phase6b1b-from-repo-files',
      'npm run db:validate-phase6b1-patient-libraries',
      '```',
      '',
      '**Sources:** `vilo-os/Medicamentos.docx`, `vilo-os/patology catalog.docx`',
      '',
    ].join('\n'),
    'utf8',
  )
}

async function main() {
  loadEnvFiles()

  const sql = await connectPostgres()
  if (!sql) {
    record('database_connect', 'BLOCKED', 'Missing DATABASE_URL / DATABASE_URL_DIRECT or connection failed')
    writeReportMd()
    console.error('Phase 6B.1 validation: no database connection')
    process.exit(1)
  }

  try {
    let tablesReady = true
    for (const t of [...LIBRARY_TABLES, ...SUBJECT_TABLES]) {
      const rel = `public.${t}`
      const rows = await sql`select to_regclass(${rel})::text as reg`
      const reg = rows[0]?.reg
      if (reg && reg !== '') record(`table_${t}`, 'PASS', reg)
      else {
        record(`table_${t}`, 'BLOCKED', 'apply migration 0043_phase6b1_patient_libraries.sql')
        tablesReady = false
      }
    }

    if (!tablesReady) {
      writeReportMd()
      console.warn(
        'Phase 6B.1 validation: BLOCKED (apply 0043) — see docs/PHASE6B1-PATIENT-LIBRARIES-VALIDATION.md',
      )
      process.exit(0)
    }

    const headache = await sql`
      select pathology_id, common_name, icd10_code
      from public.pathology_library
      where active_flag = true
        and lower(trim(common_name)) = 'headache'
      limit 1
    `
    if (headache.length) {
      record('seed_headache', 'PASS', `${headache[0].common_name} (${headache[0].icd10_code ?? 'no ICD'})`)
    } else {
      record('seed_headache', 'FAIL', 'Headache not found in pathology_library')
    }

    const metformin = await sql`
      select medication_id, medication_name
      from public.medication_library
      where active_flag = true
        and lower(trim(medication_name)) = 'metformin'
      limit 1
    `
    if (metformin.length) {
      record('seed_metformin', 'PASS', metformin[0].medication_name)
    } else {
      record('seed_metformin', 'FAIL', 'Metformin not found in medication_library')
    }

    const pathologyCount = await sql`select count(*)::int as c from public.pathology_library where active_flag = true`
    const medicationCount = await sql`select count(*)::int as c from public.medication_library where active_flag = true`
    const linkCount =
      await sql`select count(*)::int as c from public.pathology_medication_links where active_flag = true`

    record(
      'bulk_pathology_count_gt_100',
      pathologyCount[0].c > 100 ? 'PASS' : 'FAIL',
      `pathology=${pathologyCount[0].c} (run npm run db:seed-phase6b1b-from-repo-files if low)`,
    )
    record(
      'bulk_medication_count_gt_100',
      medicationCount[0].c > 100 ? 'PASS' : 'FAIL',
      `medication=${medicationCount[0].c}`,
    )
    record(
      'bulk_link_count',
      linkCount[0].c >= 8 ? 'PASS' : 'FAIL',
      `links=${linkCount[0].c}`,
    )

    const requiredPathology = [
      'Headache',
      'Migraine',
      'Hypertension',
      'GERD',
      'Osteoarthritis',
      'Asthma',
      'Depression',
      'Glaucoma',
      'Hepatitis C',
      'Breast cancer',
    ]
    for (const name of requiredPathology) {
      const rows = await sql`
        select common_name
        from public.pathology_library
        where active_flag = true
          and lower(trim(common_name)) = lower(trim(${name}))
        limit 1
      `
      record(
        `pathology_required_${name.replace(/\s+/g, '_').toLowerCase()}`,
        rows.length ? 'PASS' : 'FAIL',
        rows[0]?.common_name ?? 'missing',
      )
    }

    const requiredMeds = ['Metformin', 'Lisinopril', 'Albuterol', 'Ibuprofen']
    for (const name of requiredMeds) {
      const rows = await sql`
        select medication_name
        from public.medication_library
        where active_flag = true
          and lower(trim(medication_name)) = lower(trim(${name}))
        limit 1
      `
      record(
        `medication_required_${name.toLowerCase()}`,
        rows.length ? 'PASS' : 'FAIL',
        rows[0]?.medication_name ?? 'missing',
      )
    }

    for (const { table, name } of EXPECTED_INDEXES) {
      const idx = await sql`
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = ${table}
          and indexname = ${name}
        limit 1
      `
      if (idx.length) record(`index_${name}`, 'PASS', table)
      else record(`index_${name}`, 'FAIL', `missing on ${table}`)
    }

    for (const t of SUBJECT_TABLES) {
      const col = await sql`
        select a.attnotnull as not_null
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = ${t}
          and a.attname = 'organization_id'
          and a.attnum > 0
          and not a.attisdropped
      `
      if (col.length && col[0].not_null) {
        record(`${t}.organization_id_not_null`, 'PASS', 'tenant column required')
      } else {
        record(`${t}.organization_id_not_null`, 'FAIL', 'organization_id missing or nullable')
      }

      const fk = await sql`
        select 1
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = ${t}
          and con.contype = 'f'
          and con.confrelid = 'public.study_subjects'::regclass
        limit 1
      `
      if (fk.length) record(`${t}.study_subject_fk`, 'PASS', 'references study_subjects')
      else record(`${t}.study_subject_fk`, 'FAIL', 'missing FK to study_subjects')
    }

    const rls = await sql`
      select c.relname, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ${sql([...LIBRARY_TABLES, ...SUBJECT_TABLES])}
      order by c.relname
    `
    const rlsMap = new Map(rls.map((r) => [r.relname, r.rls]))
    for (const t of [...LIBRARY_TABLES, ...SUBJECT_TABLES]) {
      if (rlsMap.get(t)) record(`rls_enabled_${t}`, 'PASS', 'RLS on')
      else record(`rls_enabled_${t}`, 'FAIL', 'RLS off or table missing')
    }

    const policies = await sql`
      select tablename, policyname, qual::text as qual, with_check::text as with_check
      from pg_policies
      where schemaname = 'public'
        and tablename in ${sql(SUBJECT_TABLES)}
    `
    for (const t of SUBJECT_TABLES) {
      const tablePolicies = policies.filter((p) => p.tablename === t)
      const usesOrg = tablePolicies.some(
        (p) =>
          (p.qual && p.qual.includes('organization_id')) ||
          (p.with_check && p.with_check.includes('organization_id')),
      )
      if (tablePolicies.length && usesOrg) {
        record(`${t}_rls_org_scoped`, 'PASS', `${tablePolicies.length} policies reference organization_id`)
      } else if (!tablePolicies.length) {
        record(`${t}_rls_org_scoped`, 'BLOCKED', 'no policies (migration not applied?)')
      } else {
        record(`${t}_rls_org_scoped`, 'FAIL', 'policies missing organization_id scope')
      }
    }

    const libPolicies = await sql`
      select tablename, count(*)::int as c
      from pg_policies
      where schemaname = 'public'
        and tablename in ${sql(LIBRARY_TABLES)}
      group by tablename
    `
    for (const t of LIBRARY_TABLES) {
      const row = libPolicies.find((p) => p.tablename === t)
      if (row?.c >= 1) record(`${t}_rls_read_policy`, 'PASS', `${row.c} policy(ies)`)
      else record(`${t}_rls_read_policy`, 'FAIL', 'expected authenticated read policy')
    }

    async function searchPathology(term) {
      const rows = await sql`
        select common_name, synonyms
        from public.pathology_library
        where active_flag = true
          and (
            common_name ilike ${'%' + term + '%'}
            or medical_name ilike ${'%' + term + '%'}
            or synonyms ilike ${'%' + term + '%'}
          )
        limit 10
      `
      return rows
    }

    const headHits = await searchPathology('head')
    record(
      'search_synonym_head',
      headHits.some((r) => /headache/i.test(r.common_name)) ? 'PASS' : 'FAIL',
      headHits.map((r) => r.common_name).join(', ') || 'no matches',
    )

    const afibHits = await searchPathology('AFib')
    record(
      'search_synonym_afib',
      afibHits.some(
        (r) =>
          /fibrillation/i.test(r.common_name) ||
          /fibrillation/i.test(r.synonyms ?? '') ||
          /afib/i.test(r.synonyms ?? ''),
      )
        ? 'PASS'
        : 'FAIL',
      afibHits.map((r) => r.common_name).join(', ') || 'no matches',
    )

    const refluxHits = await searchPathology('acid reflux')
    record(
      'search_synonym_acid_reflux',
      refluxHits.some(
        (r) =>
          /gerd/i.test(r.common_name) ||
          /reflux/i.test(r.common_name) ||
          /reflux/i.test(r.synonyms ?? ''),
      )
        ? 'PASS'
        : 'FAIL',
      refluxHits.map((r) => r.common_name).join(', ') || 'no matches',
    )

    writeReportMd()

    if (results.summary.failed > 0) {
      console.error('Phase 6B.1 validation: FAIL — see docs/PHASE6B1-PATIENT-LIBRARIES-VALIDATION.md')
      process.exit(1)
    }
    if (results.summary.blocked > 0) {
      console.warn(
        'Phase 6B.1 validation: BLOCKED (apply 0043) — see docs/PHASE6B1-PATIENT-LIBRARIES-VALIDATION.md',
      )
      process.exit(0)
    }
    console.log('Phase 6B.1B patient libraries validation: GREEN')
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
