/**
 * Phase 11F-A — load STUDY-KOA-001 thin operational runtime (data only).
 *
 * Usage:
 *   node scripts/load-para-oa-012-runtime.mjs
 *   node scripts/load-para-oa-012-runtime.mjs --dry-run
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const DRY_RUN = process.argv.includes('--dry-run')
const manifest = JSON.parse(
  readFileSync(join(projectRoot, 'fixtures/para-oa-012/runtime-manifest.v1.json'), 'utf8'),
)

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const report = { phase: '11F-A-load', dryRun: DRY_RUN, steps: [] }

function step(name, ok, detail) {
  report.steps.push({ name, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
}

async function main() {
  const { study: studyCfg, source_bindings_by_visit_code: sdvByCode } = manifest
  const studyId = studyCfg.host_study_id
  const orgId = studyCfg.organization_id

  try {
    const [study] = await sql`select id, name from studies where id = ${studyId}`
    if (!study) {
      step('resolve study', false, studyId)
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      process.exit(1)
    }
    step('resolve study', true, `${study.name} (${studyId})`)

    if (DRY_RUN) {
      step('dry-run', true, 'no mutations')
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }

    let versionId
    const [existingVersion] = await sql`
      select id from study_versions
      where study_id = ${studyId} and version_label = ${studyCfg.version_label}
    `
    if (existingVersion) {
      versionId = existingVersion.id
      step('study version', true, `existing ${versionId}`)
    } else {
      const [inserted] = await sql`
        insert into study_versions (organization_id, study_id, version_label)
        values (${orgId}, ${studyId}, ${studyCfg.version_label})
        returning id
      `
      versionId = inserted.id
      step('study version', true, `created ${versionId}`)
    }

    await sql`
      update studies
      set name = 'Phase 3 Knee OA Study'
      where id = ${studyId}
    `
    step('study display name', true, 'Phase 3 Knee OA Study')

    await sql`
      update visit_definitions
      set eligible_subject_roles = array[${studyCfg.legacy_visit_exclude_role}]::text[]
      where study_id = ${studyId}
        and code not like 'PARA_%'
    `
    step('legacy visit defs excluded', true, studyCfg.legacy_visit_exclude_role)

    const visitIdByCode = new Map()
    for (const vd of manifest.visit_definitions) {
      const eligibleArms = vd.eligible_arms ?? null
      const [row] = await sql`
        insert into visit_definitions (
          organization_id, study_id, study_version_id, code, label, sort_order,
          target_day, window_min_offset, window_max_offset,
          eligible_arms, eligible_subject_roles, modality
        ) values (
          ${orgId}, ${studyId}, ${versionId}, ${vd.code}, ${vd.label}, ${vd.sort_order},
          ${vd.target_day}, ${vd.window_min_offset}, ${vd.window_max_offset},
          ${eligibleArms}, null, ${vd.modality}
        )
        on conflict (study_id, code) do update set
          label = excluded.label,
          sort_order = excluded.sort_order,
          study_version_id = excluded.study_version_id,
          target_day = excluded.target_day,
          window_min_offset = excluded.window_min_offset,
          window_max_offset = excluded.window_max_offset,
          eligible_arms = excluded.eligible_arms,
          eligible_subject_roles = excluded.eligible_subject_roles,
          modality = excluded.modality,
          updated_at = now()
        returning id
      `
      visitIdByCode.set(vd.code, row.id)
    }
    step('visit definitions', true, `${visitIdByCode.size} PARA visits`)

    const procIdByCode = new Map()
    for (const pd of manifest.procedure_definitions) {
      const [row] = await sql`
        insert into procedure_definitions (
          organization_id, study_id, study_version_id, code, label
        ) values (
          ${orgId}, ${studyId}, ${versionId}, ${pd.code}, ${pd.label}
        )
        on conflict (study_id, code) do update set
          label = excluded.label,
          study_version_id = excluded.study_version_id,
          updated_at = now()
        returning id
      `
      procIdByCode.set(pd.code, row.id)

      const sdvId = sdvByCode[pd.source_visit_code]
      if (sdvId) {
        await sql`
          insert into procedure_source_bindings (
            organization_id, study_id, procedure_definition_id,
            default_source_definition_version_id
          ) values (
            ${orgId}, ${studyId}, ${row.id}, ${sdvId}
          )
          on conflict (study_id, procedure_definition_id) do update set
            default_source_definition_version_id = excluded.default_source_definition_version_id,
            updated_at = now()
        `
      }
    }
    step('procedure definitions + bindings', true, `${procIdByCode.size} procedures`)

    let mapCount = 0
    for (const m of manifest.visit_procedure_maps) {
      const visitId = visitIdByCode.get(m.visit_code)
      const procId = procIdByCode.get(m.procedure_code)
      if (!visitId || !procId) {
        step('procedure map', false, `missing ${m.visit_code} / ${m.procedure_code}`)
        continue
      }
      await sql`
        insert into visit_def_procedure_map (
          organization_id, study_id, visit_definition_id, procedure_definition_id,
          is_required, sort_order, is_conditional, condition_label
        ) values (
          ${orgId}, ${studyId}, ${visitId}, ${procId},
          ${m.is_required ?? false}, ${m.sort_order ?? 1},
          ${m.is_conditional ?? false}, ${m.condition_label ?? null}
        )
        on conflict (visit_definition_id, procedure_definition_id) do update set
          is_required = excluded.is_required,
          sort_order = excluded.sort_order,
          is_conditional = excluded.is_conditional,
          condition_label = excluded.condition_label
      `
      mapCount++
    }
    step('visit procedure maps', true, `${mapCount} maps`)

    const { count: bindingCount } = await sql`
      select count(*)::int as count from procedure_source_bindings where study_id = ${studyId}
    `.then((r) => r[0])
    step('binding count', true, String(bindingCount))

    console.log(JSON.stringify(report, null, 2))
  } catch (err) {
    report.error = err.message
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
