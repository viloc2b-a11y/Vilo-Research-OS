/**
 * Phase 11F-B — STUDY-INF-001 operational buildout verification + PARA regression.
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

const mvManifest = JSON.parse(
  readFileSync(join(projectRoot, 'fixtures/mv40618/runtime-manifest.v1.json'), 'utf8'),
)
const paraManifest = JSON.parse(
  readFileSync(join(projectRoot, 'fixtures/para-oa-012/runtime-manifest.v1.json'), 'utf8'),
)

const QA_COORD = 'rbac.qa.research_coordinator@vilo-os.staging'
const STUDY_ID = mvManifest.study.host_study_id
const ORG_ID = mvManifest.study.organization_id

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
  const report = { phase: '11F-B-proof', gates: {} }
  try {
    const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
    if (!coord) {
      report.error = 'QA coordinator missing'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      process.exit(1)
    }

    const mvVisitCount = (
      await sql`select count(*)::int as c from visit_definitions where study_id = ${STUDY_ID} and code like 'MV_%'`
    )[0].c
    const mvBindings = (
      await sql`
        select count(*)::int as c from procedure_source_bindings psb
        join procedure_definitions pd on pd.id = psb.procedure_definition_id
        where psb.study_id = ${STUDY_ID} and pd.code like 'PROC_MV_%'
      `
    )[0].c
    const ready = await callRpc(sql, 'phase11fa_study_runtime_ready_for_schedule', [STUDY_ID])

    report.mvVisitDefCount = mvVisitCount
    report.mvBindings = mvBindings
    report.readiness = ready

    let mvProbe = null
    let paraProbe = null
    try {
      await sql.begin(async (tx) => {
        const suffix = Date.now().toString().slice(-6)
        const anchor = addDays(new Date().toISOString().slice(0, 10), 0)
        const householdId = crypto.randomUUID()

        const [subjIndex] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, household_id, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${'11FB-IDX-' + suffix}, 'enrolled',
            'index_patient', ${householdId}, ${anchor}
          ) returning id, household_id
        `
        const [subjContact] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, household_id, anchor_subject_id, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${'11FB-CNT-' + suffix}, 'enrolled',
            'household_contact', ${householdId}, ${subjIndex.id}, ${anchor}
          ) returning id, household_id, anchor_subject_id
        `

        const gen = async (id) => {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          return callRpc(tx, 'generate_subject_visit_schedule', [id, anchor, true])
        }

        const genIdx = await gen(subjIndex.id)
        const genCnt = await gen(subjContact.id)

        const rows = async (subjectId) =>
          tx`
            select vd.code, v.modality, v.id as visit_id
            from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId}
              and vd.code like 'MV_%'
              and v.visit_status not in ('cancelled', 'missed', 'no_show')
            order by vd.sort_order
          `

        const listIdx = await rows(subjIndex.id)
        const listCnt = await rows(subjContact.id)
        const codesIdx = listIdx.map((r) => r.code)
        const codesCnt = listCnt.map((r) => r.code)

        const sickVisit = listIdx.find((r) => r.code === 'MV_SICK_UNSCHED')
        const remoteVisit = listIdx.find((r) => r.code === 'MV_REMOTE_SYMPTOM')

        const [mapSick] = sickVisit
          ? await tx`
              select m.id from visit_def_procedure_map m
              join visit_definitions vd on vd.id = m.visit_definition_id
              join procedure_definitions pd on pd.id = m.procedure_definition_id
              where vd.code = 'MV_SICK_UNSCHED' and pd.code = 'PROC_MV_SICK_ASSESS'
            `
          : [null]

        const peSickBefore = sickVisit
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${sickVisit.visit_id} and pd.code = 'PROC_MV_SICK_ASSESS'
              `
            )[0].c
          : 0

        const peExtraBefore = remoteVisit
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${remoteVisit.visit_id} and pd.code = 'PROC_MV_EXTRA_SWAB'
              `
            )[0].c
          : 0

        let instSick = null
        if (sickVisit && mapSick) {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          instSick = await callRpc(tx, 'instantiate_conditional_procedure_execution', [
            ORG_ID,
            sickVisit.visit_id,
            mapSick.id,
          ])
        }

        const peSickAfter = sickVisit
          ? (
              await tx`
                select count(*)::int as c from procedure_executions pe
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where pe.visit_id = ${sickVisit.visit_id} and pd.code = 'PROC_MV_SICK_ASSESS'
              `
            )[0].c
          : 0

        const capturePe = listIdx.find((r) => r.code === 'MV_SCR')
          ? (
              await tx`
                select pe.id, pe.source_definition_version_id
                from procedure_executions pe
                join visits v on v.id = pe.visit_id
                join visit_definitions vd on vd.id = v.visit_definition_id
                join procedure_definitions pd on pd.id = pe.procedure_definition_id
                where v.study_subject_id = ${subjIndex.id}
                  and vd.code = 'MV_SCR'
                  and pd.code = 'PROC_MV_CONSENT'
                limit 1
              `
            )[0]
          : null

        const dupes = await tx`
          select count(*)::int as c from (
            select study_subject_id, visit_definition_id
            from visits
            where study_subject_id in (${subjIndex.id}, ${subjContact.id})
              and visit_status not in ('cancelled', 'missed', 'no_show')
            group by 1, 2 having count(*) > 1
          ) d
        `

        const paraOnIndex = (
          await tx`
            select count(*)::int as c
            from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjIndex.id} and vd.code like 'PARA_%'
          `
        )[0].c

        const [subjParaA] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm, schedule_anchor_date
          ) values (
            ${ORG_ID}, ${STUDY_ID}, ${'11FB-PARA-A-' + suffix}, 'enrolled',
            'participant', 'Arm A', ${anchor}
          ) returning id
        `
        const genParaA = await gen(subjParaA.id)
        const paraCodes = (
          await tx`
            select vd.code from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjParaA.id} and vd.code like 'PARA_%'
          `
        ).map((r) => r.code)

        mvProbe = {
          genIdx,
          genCnt,
          codesIdx,
          codesCnt,
          householdMatch: subjContact.household_id === subjIndex.household_id,
          anchorMatch: subjContact.anchor_subject_id === subjIndex.id,
          modalityHomeIdx: listIdx.find((r) => r.code === 'MV_HOME_SWAB_IDX')?.modality,
          modalityRemote: listIdx.find((r) => r.code === 'MV_REMOTE_SYMPTOM')?.modality,
          peSickBefore,
          peExtraBefore,
          peSickAfter,
          instSick,
          captureReady: Boolean(capturePe?.source_definition_version_id),
          dupes: dupes[0].c,
          paraOnIndex,
        }

        paraProbe = {
          genParaA,
          paraCodes,
          armAOnly:
            paraCodes.includes('PARA_ARM_A_MON')
            && !paraCodes.includes('PARA_ARM_B_MON')
            && paraCodes.includes('PARA_SCR'),
        }

        throw new Error('ROLLBACK_PROBE')
      })
    } catch (err) {
      if (err.message !== 'ROLLBACK_PROBE') throw err
    }

    report.mvProbe = mvProbe
    report.paraProbe = paraProbe
    report.gates = {
      mv_defs_loaded: { pass: mvVisitCount >= 10 },
      mv_bindings: { pass: mvBindings >= 10 },
      readiness_rpc: { pass: ready?.ok === true },
      schedule_gen: {
        pass: mvProbe?.genIdx?.ok === true && mvProbe?.genCnt?.ok === true,
      },
      role_split_index: {
        pass:
          mvProbe?.codesIdx?.includes('MV_SCR')
          && mvProbe?.codesIdx?.includes('MV_HOME_SWAB_IDX')
          && !mvProbe?.codesIdx?.includes('MV_CNT_ENROLL')
          && !mvProbe?.codesIdx?.includes('MV_HOME_SWAB_CNT'),
      },
      role_split_contact: {
        pass:
          mvProbe?.codesCnt?.includes('MV_CNT_ENROLL')
          && mvProbe?.codesCnt?.includes('MV_HOME_SWAB_CNT')
          && !mvProbe?.codesCnt?.includes('MV_SCR')
          && !mvProbe?.codesCnt?.includes('MV_HOME_SWAB_IDX'),
      },
      shared_common_visits: {
        pass:
          mvProbe?.codesIdx?.includes('MV_PHONE_WK2')
          && mvProbe?.codesCnt?.includes('MV_PHONE_WK2')
          && mvProbe?.codesIdx?.includes('MV_EOS')
          && mvProbe?.codesCnt?.includes('MV_EOS'),
      },
      household_linkage: {
        pass: mvProbe?.householdMatch === true && mvProbe?.anchorMatch === true,
      },
      modalities: {
        pass: mvProbe?.modalityHomeIdx === 'home' && mvProbe?.modalityRemote === 'remote',
      },
      conditional_not_auto: {
        pass: mvProbe?.peSickBefore === 0 && mvProbe?.peExtraBefore === 0,
      },
      conditional_instantiate: {
        pass: mvProbe?.instSick?.ok === true && mvProbe?.peSickAfter === 1,
      },
      source_binding_on_pe: { pass: mvProbe?.captureReady === true },
      no_duplicate_visits: { pass: (mvProbe?.dupes ?? 1) === 0 },
      para_not_on_index: { pass: (mvProbe?.paraOnIndex ?? 1) === 0 },
      para_regression: {
        pass: paraProbe?.genParaA?.ok === true && paraProbe?.armAOnly === true,
      },
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
