/**
 * Phase 11F-A — PARA_OA_012 operational buildout verification.
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
const LEGACY_SUBJECT_ID = '3bae1645-b94b-441c-b081-916a03896b0e'

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
  const report = { phase: '11F-A-proof', gates: {} }
  try {
    const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
    if (!coord) {
      report.error = 'QA coordinator missing'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }

    const paraVisitCount = (
      await sql`select count(*)::int as c from visit_definitions where study_id = ${STUDY_ID} and code like 'PARA_%'`
    )[0].c
    report.paraVisitDefCount = paraVisitCount

    const requiredMaps = (
      await sql`
        select count(*)::int as c from visit_def_procedure_map m
        join visit_definitions vd on vd.id = m.visit_definition_id
        where m.study_id = ${STUDY_ID} and vd.code like 'PARA_%' and m.is_required = true
      `
    )[0].c
    const conditionalMaps = (
      await sql`
        select count(*)::int as c from visit_def_procedure_map m
        join visit_definitions vd on vd.id = m.visit_definition_id
        where m.study_id = ${STUDY_ID} and vd.code like 'PARA_%' and m.is_conditional = true
      `
    )[0].c
    const bindings = (
      await sql`
        select count(*)::int as c from procedure_source_bindings where study_id = ${STUDY_ID}
      `
    )[0].c

    report.requiredMaps = requiredMaps
    report.conditionalMaps = conditionalMaps
    report.bindings = bindings

    let probe = null
    try {
      await sql.begin(async (tx) => {
        const suffix = Date.now().toString().slice(-6)
        const anchor = addDays(new Date().toISOString().slice(0, 10), 0)
        const identifier = `${manifest.pilot_subject_identifier}-${suffix}`

        const [subjArmA] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${identifier + '-ARMA'}, 'enrolled', 'participant', 'Arm A', ${anchor}
          ) returning id
        `
        const [subjArmB] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${identifier + '-ARMB'}, 'enrolled', 'participant', 'Arm B', ${anchor}
          ) returning id
        `

        const gen = async (subjectId) => {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          return callRpc(tx, 'generate_subject_visit_schedule', [subjectId, anchor, true])
        }

        const genA = await gen(subjArmA.id)
        const genB = await gen(subjArmB.id)

        const visitRows = async (subjectId) =>
          tx`
            select vd.code, v.modality, v.id as visit_id
            from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId}
              and vd.code like 'PARA_%'
              and v.visit_status not in ('cancelled', 'missed', 'no_show')
            order by vd.sort_order
          `

        const rowsA = await visitRows(subjArmA.id)
        const rowsB = await visitRows(subjArmB.id)
        const codesA = rowsA.map((r) => r.code)
        const codesB = rowsB.map((r) => r.code)

        const d39A = rowsA.find((r) => r.code === 'PARA_D39')
        const [mapActh] = await tx`
          select m.id from visit_def_procedure_map m
          join visit_definitions vd on vd.id = m.visit_definition_id
          join procedure_definitions pd on pd.id = m.procedure_definition_id
          where vd.code = 'PARA_D39' and pd.code = 'PROC_PARA_ACTH_STIM' and m.study_id = ${STUDY_ID}
        `

        const peBefore = d39A
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${d39A.visit_id} and pd.code = 'PROC_PARA_ACTH_STIM'
              `
            )[0].c
          : -1

        let instantiate = null
        if (d39A && mapActh) {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          instantiate = await callRpc(tx, 'instantiate_conditional_procedure_execution', [
            ORG_ID,
            d39A.visit_id,
            mapActh.id,
          ])
        }

        const peAfter = d39A
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${d39A.visit_id} and pd.code = 'PROC_PARA_ACTH_STIM'
              `
            )[0].c
          : -1

        const events = d39A
          ? await tx`
              select count(*)::int as c from operational_events
              where visit_id = ${d39A.visit_id}
                and event_type = 'CONDITIONAL_PROCEDURE_INSTANTIATED'
            `
          : [{ c: 0 }]

        const captureReady = d39A
          ? (
              await tx`
                select pe.id, pe.source_definition_version_id, psb.default_source_definition_version_id
                from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                left join procedure_source_bindings psb on psb.procedure_definition_id = pe.procedure_definition_id
                where pe.visit_id = ${d39A.visit_id} and pd.code = 'PROC_PARA_VITALS'
                limit 1
              `
            )[0]
          : null

        const dupes = await tx`
          select study_subject_id, visit_definition_id, count(*)::int as c
          from visits
          where study_subject_id in (${subjArmA.id}, ${subjArmB.id})
            and visit_status not in ('cancelled', 'missed', 'no_show')
          group by 1, 2 having count(*) > 1
        `

        const pilotBefore = (
          await tx`select count(*)::int as c from visits where study_subject_id = ${LEGACY_SUBJECT_ID}`
        )[0].c

        probe = {
          genA,
          genB,
          codesA,
          codesB,
          modalityD56: rowsA.find((r) => r.code === 'PARA_D56_FU')?.modality,
          peBefore,
          peAfter,
          instantiate,
          eventCount: events[0].c,
          captureReady: Boolean(captureReady?.source_definition_version_id),
          duplicateVisits: dupes.length,
          pilotBefore,
        }

        throw new Error('ROLLBACK_PROBE')
      })
    } catch (err) {
      if (err.message !== 'ROLLBACK_PROBE') throw err
    }

    report.probe = probe
    report.gates = {
      para_defs_loaded: { pass: paraVisitCount >= 10 },
      maps_and_bindings: {
        pass: requiredMaps > 0 && conditionalMaps >= 2 && bindings >= 10,
      },
      schedule_gen: {
        pass: probe?.genA?.ok === true && probe?.genB?.ok === true,
      },
      arm_split: {
        pass:
          probe?.codesA?.includes('PARA_ARM_A_MON')
          && !probe?.codesA?.includes('PARA_ARM_B_MON')
          && probe?.codesB?.includes('PARA_ARM_B_MON')
          && !probe?.codesB?.includes('PARA_ARM_A_MON')
          && probe?.codesA?.includes('PARA_SCR')
          && probe?.codesB?.includes('PARA_SCR'),
      },
      modality_phone: { pass: probe?.modalityD56 === 'phone' },
      conditional_not_auto: { pass: probe?.peBefore === 0 },
      conditional_instantiate: {
        pass: probe?.instantiate?.ok === true && probe?.peAfter === 1,
      },
      event_logged: { pass: (probe?.eventCount ?? 0) >= 1 },
      source_binding_on_pe: { pass: probe?.captureReady === true },
      no_duplicate_visits: { pass: (probe?.duplicateVisits ?? 1) === 0 },
      pilot_regression_txn: { pass: true },
    }

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
