/**
 * Phase 6B.1B — Idempotent bulk seed for pathology_library, medication_library, pathology_medication_links.
 *
 * Usage: npm run db:seed-phase6b1b-patient-libraries
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'
import {
  buildMedicationTerms,
  buildPathologyTerms,
  buildSuggestedLinks,
} from './lib/patient-library-bulk-data.mjs'

const report = {
  runAt: new Date().toISOString(),
  phase: '6B.1B',
  pathology: { inserted: 0, updated: 0, skipped: 0 },
  medication: { inserted: 0, updated: 0, skipped: 0 },
  links: { inserted: 0, updated: 0, skipped: 0, skipped_reasons: [] },
  counts: { pathology: 0, medication: 0, links: 0 },
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

function loadPathologyTerms() {
  const path = resolve(projectRoot, 'fixtures/pathology/pathology-catalog-bulk.v1.json')
  if (existsSync(path)) {
    const json = JSON.parse(readFileSync(path, 'utf8'))
    return json.terms ?? []
  }
  return buildPathologyTerms()
}

function loadMedicationTerms() {
  const path = resolve(projectRoot, 'fixtures/pathology/medication-library-bulk.v1.json')
  if (existsSync(path)) {
    const json = JSON.parse(readFileSync(path, 'utf8'))
    return json.medications ?? []
  }
  return buildMedicationTerms()
}

function loadLinks() {
  const path = resolve(projectRoot, 'fixtures/pathology/pathology-medication-links-bulk.v1.json')
  if (existsSync(path)) {
    const json = JSON.parse(readFileSync(path, 'utf8'))
    return json.links ?? []
  }
  return buildSuggestedLinks()
}

async function upsertPathology(sql, row) {
  const synonyms = Array.isArray(row.synonyms) ? row.synonyms.join(', ') : row.synonyms
  const icd = row.icd10_code ?? ''
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
    let pathologySeedId = row.external_seed_id ?? null
    if (pathologySeedId != null) {
      const taken = await sql`
        select pathology_id
        from public.pathology_library
        where external_seed_id = ${pathologySeedId}
          and pathology_id <> ${existing[0].pathology_id}
        limit 1
      `
      if (taken.length) pathologySeedId = existing[0].external_seed_id
    }
    await sql`
      update public.pathology_library
      set
        external_seed_id = ${pathologySeedId},
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
    return existing[0].pathology_id
  }

  let pathologySeedId = row.external_seed_id ?? null
  if (pathologySeedId != null) {
    const taken = await sql`
      select 1 from public.pathology_library where external_seed_id = ${pathologySeedId} limit 1
    `
    if (taken.length) pathologySeedId = null
  }

  const inserted = await sql`
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
      ${pathologySeedId},
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
    returning pathology_id
  `
  report.pathology.inserted++
  return inserted[0].pathology_id
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
    let medicationSeedId = row.external_seed_id ?? null
    if (medicationSeedId != null) {
      const taken = await sql`
        select medication_id
        from public.medication_library
        where external_seed_id = ${medicationSeedId}
          and medication_id <> ${existing[0].medication_id}
        limit 1
      `
      if (taken.length) medicationSeedId = null
    }
    await sql`
      update public.medication_library
      set
        external_seed_id = coalesce(${medicationSeedId}, external_seed_id),
        brand_name = ${row.brand_name ?? null},
        drug_class = ${row.drug_class ?? null},
        route = ${row.route ?? null},
        dosage_form = ${row.dosage_form ?? null},
        active_flag = ${row.active_flag !== false}
      where medication_id = ${existing[0].medication_id}
    `
    report.medication.updated++
    return existing[0].medication_id
  }

  let medicationSeedId = row.external_seed_id ?? null
  if (medicationSeedId != null) {
    const taken = await sql`
      select 1 from public.medication_library where external_seed_id = ${medicationSeedId} limit 1
    `
    if (taken.length) medicationSeedId = null
  }

  const inserted = await sql`
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
      ${medicationSeedId},
      ${row.medication_name},
      ${row.brand_name ?? null},
      ${row.drug_class ?? null},
      ${row.route ?? null},
      ${row.dosage_form ?? null},
      ${row.active_flag !== false}
    )
    returning medication_id
  `
  report.medication.inserted++
  return inserted[0].medication_id
}

async function resolvePathologyId(sql, commonName, icd10) {
  const rows = await sql`
    select pathology_id
    from public.pathology_library
    where lower(trim(common_name)) = lower(trim(${commonName}))
      and coalesce(icd10_code, '') = coalesce(${icd10 ?? ''}, '')
    limit 1
  `
  return rows[0]?.pathology_id ?? null
}

async function resolveMedicationId(sql, name, route, form) {
  const rows = await sql`
    select medication_id
    from public.medication_library
    where lower(trim(medication_name)) = lower(trim(${name}))
      and coalesce(route, '') = coalesce(${route ?? ''}, '')
      and coalesce(dosage_form, '') = coalesce(${form ?? ''}, '')
    limit 1
  `
  return rows[0]?.medication_id ?? null
}

async function upsertLink(sql, link) {
  const pathologyId = await resolvePathologyId(
    sql,
    link.pathology_common_name,
    link.pathology_icd10,
  )
  const medicationId = await resolveMedicationId(
    sql,
    link.medication_name,
    link.medication_route,
    link.medication_dosage_form,
  )

  if (!pathologyId || !medicationId) {
    report.links.skipped++
    report.links.skipped_reasons.push({
      pathology: link.pathology_common_name,
      medication: link.medication_name,
      reason: !pathologyId ? 'pathology_not_found' : 'medication_not_found',
    })
    return
  }

  const existing = await sql`
    select link_id
    from public.pathology_medication_links
    where pathology_id = ${pathologyId}
      and medication_id = ${medicationId}
      and coalesce(relation_type, '') = coalesce(${link.relation_type ?? 'common_concomitant'}, '')
    limit 1
  `

  if (existing.length) {
    await sql`
      update public.pathology_medication_links
      set
        relation_rank = ${link.relation_rank ?? null},
        notes = ${link.notes ?? null},
        active_flag = true
      where link_id = ${existing[0].link_id}
    `
    report.links.updated++
    return
  }

  await sql`
    insert into public.pathology_medication_links (
      pathology_id,
      medication_id,
      relation_rank,
      relation_type,
      notes,
      active_flag
    )
    values (
      ${pathologyId},
      ${medicationId},
      ${link.relation_rank ?? null},
      ${link.relation_type ?? 'common_concomitant'},
      ${link.notes ?? null},
      true
    )
  `
  report.links.inserted++
}

async function main() {
  loadEnvFiles()
  const sql = await connectPostgres()
  if (!sql) {
    console.error('Phase 6B.1B seed: no database connection (DATABASE_URL / DATABASE_URL_DIRECT)')
    process.exit(1)
  }

  try {
    const reg = await sql`select to_regclass('public.pathology_library')::text as reg`
    if (!reg[0]?.reg) {
      console.error('Apply migration 0043 before bulk seed.')
      process.exit(1)
    }

    const pathologyTerms = loadPathologyTerms()
    const medicationTerms = loadMedicationTerms()
    const links = loadLinks()

    for (const row of pathologyTerms) {
      try {
        await upsertPathology(sql, row)
      } catch (e) {
        report.pathology.skipped++
        console.warn('pathology skip', row.common_name, e.message)
      }
    }

    for (const row of medicationTerms) {
      try {
        await upsertMedication(sql, row)
      } catch (e) {
        report.medication.skipped++
        console.warn('medication skip', row.medication_name, e.message)
      }
    }

    for (const link of links) {
      try {
        await upsertLink(sql, link)
      } catch (e) {
        report.links.skipped++
        report.links.skipped_reasons.push({
          pathology: link.pathology_common_name,
          medication: link.medication_name,
          reason: e.message,
        })
      }
    }

    const [pCount, mCount, lCount] = await Promise.all([
      sql`select count(*)::int as c from public.pathology_library where active_flag = true`,
      sql`select count(*)::int as c from public.medication_library where active_flag = true`,
      sql`select count(*)::int as c from public.pathology_medication_links where active_flag = true`,
    ])
    report.counts = {
      pathology: pCount[0].c,
      medication: mCount[0].c,
      links: lCount[0].c,
    }

    const outPath = resolve(projectRoot, 'tmp/imports/phase6b1b-patient-libraries-seed-report.json')
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

    console.log('Phase 6B.1B bulk seed complete')
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
