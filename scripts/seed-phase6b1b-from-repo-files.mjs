/**
 * Phase 6B.1B — Seed pathology_library + medication_library from repo DOCX sources.
 *
 * Sources (vilo-os root):
 *   - patology catalog.docx → pathology_library
 *   - Medicamentos.docx → medication_library (MEDICATION rows only; LINK rows ignored)
 *
 * Usage: npm run db:seed-phase6b1b-from-repo-files
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const report = {
  runAt: new Date().toISOString(),
  phase: '6B.1B-repo',
  sources: {},
  pathology: { inserted: 0, updated: 0, skipped: 0 },
  medication: { inserted: 0, updated: 0, skipped: 0 },
  counts: { pathology: 0, medication: 0 },
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
  for (const raw of pickDatabaseUrlsInOrder()) {
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

function loadParsedFromRepoFiles() {
  const pathologyDocx = resolve(projectRoot, 'patology catalog.docx')
  const medicationsDocx = resolve(projectRoot, 'Medicamentos.docx')
  const parser = resolve(projectRoot, 'scripts/lib/parse_patient_library_docx.py')

  const stdout = execFileSync('python', [parser, pathologyDocx, medicationsDocx], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })

  const parsed = JSON.parse(stdout)
  if (parsed.error) {
    throw new Error(parsed.error)
  }

  report.sources = {
    pathology_file: pathologyDocx,
    medications_file: medicationsDocx,
    format: 'docx (paragraph CSV / concatenated catalog rows)',
    meta: parsed.meta,
  }

  const outDir = resolve(projectRoot, 'fixtures/pathology/repo-import')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    resolve(outDir, 'pathology-from-repo.v1.json'),
    JSON.stringify({ terms: parsed.pathology, meta: parsed.meta.pathology }, null, 2),
    'utf8',
  )
  writeFileSync(
    resolve(outDir, 'medications-from-repo.v1.json'),
    JSON.stringify({ medications: parsed.medications, meta: parsed.meta.medications }, null, 2),
    'utf8',
  )

  return parsed
}

async function upsertPathology(sql, row) {
  const icd = row.icd10_code ?? ''
  const synonyms = Array.isArray(row.synonyms) ? row.synonyms.join(', ') : row.synonyms

  let existing = await sql`
    select pathology_id, external_seed_id
    from public.pathology_library
    where lower(trim(common_name)) = lower(trim(${row.common_name}))
      and coalesce(icd10_code, '') = coalesce(${icd}, '')
    limit 1
  `

  if (!existing.length && row.medical_name) {
    existing = await sql`
      select pathology_id, external_seed_id
      from public.pathology_library
      where lower(trim(system)) = lower(trim(${row.system}))
        and lower(trim(medical_name)) = lower(trim(${row.medical_name}))
        and coalesce(icd10_code, '') = coalesce(${icd}, '')
      limit 1
    `
  }

  if (existing.length) {
    let seedId = row.external_seed_id ?? null
    if (seedId != null) {
      const taken = await sql`
        select pathology_id
        from public.pathology_library
        where external_seed_id = ${seedId}
          and pathology_id <> ${existing[0].pathology_id}
        limit 1
      `
      if (taken.length) seedId = null
    }

    await sql`
      update public.pathology_library
      set
        external_seed_id = coalesce(${seedId}, external_seed_id),
        system = ${row.system},
        common_name = ${row.common_name},
        medical_name = ${row.medical_name ?? null},
        icd10_code = ${row.icd10_code ?? null},
        synonyms = ${synonyms ?? null},
        chronic_acute = ${row.chronic_acute ?? null},
        sex_specific = ${row.sex_specific ?? null},
        pediatric_use = ${row.pediatric_use ?? false},
        active_flag = ${row.active_flag !== false}
      where pathology_id = ${existing[0].pathology_id}
    `
    report.pathology.updated++
    return
  }

  let seedId = row.external_seed_id ?? null
  if (seedId != null) {
    const taken = await sql`
      select 1 from public.pathology_library where external_seed_id = ${seedId} limit 1
    `
    if (taken.length) seedId = null
  }

  await sql`
    insert into public.pathology_library (
      external_seed_id,
      system,
      common_name,
      medical_name,
      icd10_code,
      synonyms,
      chronic_acute,
      sex_specific,
      pediatric_use,
      active_flag
    )
    values (
      ${seedId},
      ${row.system},
      ${row.common_name},
      ${row.medical_name ?? null},
      ${row.icd10_code ?? null},
      ${synonyms ?? null},
      ${row.chronic_acute ?? null},
      ${row.sex_specific ?? null},
      ${row.pediatric_use ?? false},
      ${row.active_flag !== false}
    )
  `
  report.pathology.inserted++
}

async function upsertMedication(sql, row) {
  const route = row.route ?? ''
  const form = row.dosage_form ?? ''

  const existing = await sql`
    select medication_id
    from public.medication_library
    where lower(trim(medication_name)) = lower(trim(${row.medication_name}))
      and coalesce(route, '') = coalesce(${route}, '')
      and coalesce(dosage_form, '') = coalesce(${form}, '')
    limit 1
  `

  if (existing.length) {
    let seedId = row.external_seed_id ?? null
    if (seedId != null) {
      const taken = await sql`
        select medication_id
        from public.medication_library
        where external_seed_id = ${seedId}
          and medication_id <> ${existing[0].medication_id}
        limit 1
      `
      if (taken.length) seedId = null
    }

    await sql`
      update public.medication_library
      set
        external_seed_id = coalesce(${seedId}, external_seed_id),
        brand_name = ${row.brand_name ?? null},
        drug_class = ${row.drug_class ?? null},
        route = ${row.route ?? null},
        dosage_form = ${row.dosage_form ?? null},
        active_flag = ${row.active_flag !== false}
      where medication_id = ${existing[0].medication_id}
    `
    report.medication.updated++
    return
  }

  let seedId = row.external_seed_id ?? null
  if (seedId != null) {
    const taken = await sql`
      select 1 from public.medication_library where external_seed_id = ${seedId} limit 1
    `
    if (taken.length) seedId = null
  }

  await sql`
    insert into public.medication_library (
      external_seed_id,
      medication_name,
      brand_name,
      drug_class,
      route,
      dosage_form,
      active_flag
    )
    values (
      ${seedId},
      ${row.medication_name},
      ${row.brand_name ?? null},
      ${row.drug_class ?? null},
      ${row.route ?? null},
      ${row.dosage_form ?? null},
      ${row.active_flag !== false}
    )
  `
  report.medication.inserted++
}

async function main() {
  loadEnvFiles()

  const parsed = loadParsedFromRepoFiles()
  const sql = await connectPostgres()
  if (!sql) {
    console.error('No database connection (DATABASE_URL / DATABASE_URL_DIRECT)')
    process.exit(1)
  }

  try {
    for (const row of parsed.pathology) {
      try {
        await upsertPathology(sql, row)
      } catch (e) {
        report.pathology.skipped++
        console.warn('pathology skip', row.common_name, e.message)
      }
    }

    for (const row of parsed.medications) {
      try {
        await upsertMedication(sql, row)
      } catch (e) {
        report.medication.skipped++
        console.warn('medication skip', row.medication_name, e.message)
      }
    }

    const [pCount, mCount] = await Promise.all([
      sql`select count(*)::int as c from public.pathology_library where active_flag = true`,
      sql`select count(*)::int as c from public.medication_library where active_flag = true`,
    ])
    report.counts = { pathology: pCount[0].c, medication: mCount[0].c }

    const outPath = resolve(projectRoot, 'tmp/imports/phase6b1b-repo-seed-report.json')
    mkdirSync(resolve(projectRoot, 'tmp/imports'), { recursive: true })
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

    console.log('Phase 6B.1B repo seed complete')
    console.log(JSON.stringify(report, null, 2))
    console.log(`Report: ${outPath}`)
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
