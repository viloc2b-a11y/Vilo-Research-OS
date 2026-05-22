/**
 * Phase 11F-A-HARDEN — schedule RPC readiness gate + PARA revalidation.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const manifest = JSON.parse(
  readFileSync(join(projectRoot, 'fixtures/para-oa-012/runtime-manifest.v1.json'), 'utf8'),
)
const QA_COORD = 'rbac.qa.research_coordinator@vilo-os.staging'
const STUDY_ID = manifest.study.host_study_id
const ORG_ID = manifest.study.organization_id

async function apply0072() {
  const path = join(projectRoot, 'supabase/migrations/0072_phase11fa_schedule_readiness_gate.sql')
  await sql.unsafe(readFileSync(path, 'utf8'))
  const exists = await sql`
    select 1 from supabase_migrations.schema_migrations
    where name = '0072_phase11fa_schedule_readiness_gate'
  `
  if (!exists.length) {
    await sql`
      insert into supabase_migrations.schema_migrations (version, name)
      values ('0072', '0072_phase11fa_schedule_readiness_gate')
    `
  }
}

async function callRpc(tx, fnName, values) {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await tx.unsafe(`select public.${fnName}(${placeholders}) as result`, values)
  return rows[0]?.result
}

function addDays(iso, offset) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const report = { phase: '11F-A-HARDEN', gates: {} }
  try {
    await apply0072()
    report.migration = '0072 applied'

    const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
    if (!coord) {
      report.error = 'QA coordinator missing'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }

    const readyPara = await callRpc(sql, 'phase11fa_study_runtime_ready_for_schedule', [STUDY_ID])
    report.paraStudyReady = readyPara

    let negative = null
    let paraProbe = null
    try {
      await sql.begin(async (tx) => {
        const [badStudy] = await tx`
          insert into studies (organization_id, name, slug, status)
          values (${ORG_ID}, ${'11FA-NOT-READY-' + Date.now()}, ${'11fa-not-ready-' + Date.now()}, 'active')
          returning id
        `
        const readyBad = await callRpc(tx, 'phase11fa_study_runtime_ready_for_schedule', [badStudy.id])

        const suffix = Date.now().toString().slice(-6)
        const anchor = addDays(new Date().toISOString().slice(0, 10), 0)

        const [subjBlock] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${'11FA-BLOCK-' + suffix}, 'enrolled', ${anchor}
          ) returning id
        `
        const visitsBeforeBlock = (
          await tx`select count(*)::int as c from visits where study_subject_id = ${subjBlock.id}`
        )[0].c
        const peBeforeBlock = (
          await tx`
            select count(*)::int as c
            from procedure_executions pe
            join visits v on v.id = pe.visit_id
            where v.study_subject_id = ${subjBlock.id}
          `
        )[0].c

        await tx`
          delete from procedure_source_bindings psb
          using procedure_definitions pd
          where psb.procedure_definition_id = pd.id
            and psb.study_id = ${STUDY_ID}
            and pd.code = 'PROC_PARA_VITALS'
        `

        await tx`select set_config('role', 'authenticated', true)`
        await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
        const rpcBlocked = await callRpc(tx, 'generate_subject_visit_schedule', [subjBlock.id, anchor, true])

        const visitsAfterBlock = (
          await tx`select count(*)::int as c from visits where study_subject_id = ${subjBlock.id}`
        )[0].c
        const peAfterBlock = (
          await tx`
            select count(*)::int as c
            from procedure_executions pe
            join visits v on v.id = pe.visit_id
            where v.study_subject_id = ${subjBlock.id}
          `
        )[0].c

        const [pdVitals] = await tx`
          select id from procedure_definitions where study_id = ${STUDY_ID} and code = 'PROC_PARA_VITALS'
        `
        await tx`
          insert into procedure_source_bindings (
            organization_id, study_id, procedure_definition_id, default_source_definition_version_id
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${pdVitals.id},
            ${manifest.source_bindings_by_visit_code.D1}
          )
          on conflict (study_id, procedure_definition_id) do update set
            default_source_definition_version_id = excluded.default_source_definition_version_id
        `

        negative = {
          readyBad,
          rpcBlocked,
          visitsBeforeBlock,
          visitsAfterBlock,
          peBeforeBlock,
          peAfterBlock,
        }

        const [subjA] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            randomization_arm, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${'11FA-ARMA-' + suffix}, 'enrolled', 'Arm A', ${anchor}
          ) returning id
        `
        const [subjB] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            randomization_arm, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${'11FA-ARMB-' + suffix}, 'enrolled', 'Arm B', ${anchor}
          ) returning id
        `

        const gen = async (id) => {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          return callRpc(tx, 'generate_subject_visit_schedule', [id, anchor, true])
        }

        const genA = await gen(subjA.id)
        const genB = await gen(subjB.id)

        const rows = async (subjectId) =>
          tx`
            select vd.code, v.modality, v.id as visit_id
            from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId}
              and vd.code like 'PARA_%'
              and v.visit_status not in ('cancelled', 'missed', 'no_show')
          `

        const listA = await rows(subjA.id)
        const listB = await rows(subjB.id)
        const d39 = listA.find((r) => r.code === 'PARA_D39')
        const [mapActh] = await tx`
          select m.id from visit_def_procedure_map m
          join visit_definitions vd on vd.id = m.visit_definition_id
          join procedure_definitions pd on pd.id = m.procedure_definition_id
          where vd.code = 'PARA_D39' and pd.code = 'PROC_PARA_ACTH_STIM'
        `
        const peCondBefore = d39
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${d39.visit_id} and pd.code = 'PROC_PARA_ACTH_STIM'
              `
            )[0].c
          : 0

        let inst = null
        if (d39 && mapActh) {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          inst = await callRpc(tx, 'instantiate_conditional_procedure_execution', [
            ORG_ID,
            d39.visit_id,
            mapActh.id,
          ])
        }

        const peCondAfter = d39
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${d39.visit_id} and pd.code = 'PROC_PARA_ACTH_STIM'
              `
            )[0].c
          : 0

        const dupes = await tx`
          select count(*)::int as c from (
            select study_subject_id, visit_definition_id
            from visits
            where study_subject_id in (${subjA.id}, ${subjB.id})
              and visit_status not in ('cancelled', 'missed', 'no_show')
            group by 1, 2 having count(*) > 1
          ) d
        `

        paraProbe = {
          genA,
          genB,
          codesA: listA.map((r) => r.code),
          codesB: listB.map((r) => r.code),
          modalityD56: listA.find((r) => r.code === 'PARA_D56_FU')?.modality,
          peCondBefore,
          peCondAfter,
          inst,
          dupes: dupes[0].c,
        }

        throw new Error('ROLLBACK_PROBE')
      })
    } catch (err) {
      if (err.message !== 'ROLLBACK_PROBE') throw err
    }

    report.negative = negative
    report.paraProbe = paraProbe
    report.gates = {
      para_study_ready_fn: { pass: readyPara?.ok === true },
      readiness_blocks_empty_study: { pass: negative?.readyBad?.ok === false },
      rpc_blocks_when_not_ready: {
        pass:
          negative?.rpcBlocked?.ok === false
          && negative?.visitsAfterBlock === negative?.visitsBeforeBlock
          && negative?.peAfterBlock === negative?.peBeforeBlock,
      },
      para_schedule_gen: {
        pass: paraProbe?.genA?.ok === true && paraProbe?.genB?.ok === true,
      },
      arm_split: {
        pass:
          paraProbe?.codesA?.includes('PARA_ARM_A_MON')
          && !paraProbe?.codesA?.includes('PARA_ARM_B_MON')
          && paraProbe?.codesB?.includes('PARA_ARM_B_MON')
          && !paraProbe?.codesB?.includes('PARA_ARM_A_MON'),
      },
      modality: { pass: paraProbe?.modalityD56 === 'phone' },
      conditional_not_auto: { pass: paraProbe?.peCondBefore === 0 },
      conditional_instantiate: {
        pass: paraProbe?.inst?.ok === true && paraProbe?.peCondAfter === 1,
      },
      no_duplicates: { pass: (paraProbe?.dupes ?? 1) === 0 },
    }

    console.log(JSON.stringify(report, null, 2))
    const allPass = Object.values(report.gates).every((g) => g.pass)
    process.exit(allPass ? 0 : 1)
  } catch (err) {
    report.error = err.message
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
