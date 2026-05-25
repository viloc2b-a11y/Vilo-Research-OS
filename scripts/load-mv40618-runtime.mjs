/**
 * Phase 11F-B — load STUDY-INF-001 thin operational runtime (data only).
 *
 * Usage:
 *   node scripts/load-mv40618-runtime.mjs
 *   node scripts/load-mv40618-runtime.mjs --dry-run
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const DRY_RUN = process.argv.includes('--dry-run')
const manifest = JSON.parse(
  readFileSync(join(projectRoot, 'fixtures/mv40618/runtime-manifest.v1.json'), 'utf8'),
)

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const report = { phase: '11F-B-load', dryRun: DRY_RUN, steps: [] }

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

    if (studyCfg.display_name) {
      await sql`update studies set name = ${studyCfg.display_name} where id = ${studyId}`
      step('study display name', true, studyCfg.display_name)
    }

    if (studyCfg.para_visit_role_scope?.length) {
      await sql`
        update visit_definitions
        set eligible_subject_roles = ${studyCfg.para_visit_role_scope}
        where study_id = ${studyId}
          and code like 'PARA_%'
          and (
            eligible_subject_roles is null
            or eligible_subject_roles = array['__legacy_para_excluded__']::text[]
          )
      `
      step('PARA visits scoped to participant', true, studyCfg.para_visit_role_scope.join(', '))
    }

    const visitIdByCode = new Map()
    for (const vd of manifest.visit_definitions) {
      const eligibleRoles = vd.eligible_subject_roles ?? null
      const [row] = await sql`
        insert into visit_definitions (
          organization_id, study_id, study_version_id, code, label, sort_order,
          target_day, window_min_offset, window_max_offset,
          eligible_subject_roles, modality
        ) values (
          ${orgId}, ${studyId}, ${versionId}, ${vd.code}, ${vd.label}, ${vd.sort_order},
          ${vd.target_day}, ${vd.window_min_offset}, ${vd.window_max_offset},
          ${eligibleRoles}, ${vd.modality}
        )
        on conflict (study_id, code) do update set
          label = excluded.label,
          sort_order = excluded.sort_order,
          study_version_id = excluded.study_version_id,
          target_day = excluded.target_day,
          window_min_offset = excluded.window_min_offset,
          window_max_offset = excluded.window_max_offset,
          eligible_subject_roles = excluded.eligible_subject_roles,
          modality = excluded.modality,
          updated_at = now()
        returning id
      `
      visitIdByCode.set(vd.code, row.id)
    }
    step('visit definitions', true, `${visitIdByCode.size} MV visits`)

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

    const ready = await sql`
      select public.phase11fa_study_runtime_ready_for_schedule(${studyId}::uuid) as result
    `.then((r) => r[0]?.result)
    step('schedule readiness RPC', ready?.ok === true, JSON.stringify(ready?.blockers ?? []))

    console.log(JSON.stringify(report, null, 2))
    const failed = report.steps.some((s) => s.status === 'FAIL')
    process.exit(failed ? 1 : 0)
  } catch (err) {
    report.error = err.message
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
