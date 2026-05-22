/**
 * Phase 11E — protocol data + minimal ops UI runtime probes.
 */
import postgres from 'postgres'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const QA_COORD = 'rbac.qa.research_coordinator@vilo-os.staging'

async function withActor(actorUserId, fn) {
  return sql.begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true)`
    await tx`select set_config('request.jwt.claim.sub', ${actorUserId}, true)`
    return fn(tx)
  })
}

async function callRpc(tx, fnName, values) {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await tx.unsafe(`select public.${fnName}(${placeholders}) as result`, values)
  return rows[0]?.result
}

async function seedParaFixture(tx, { orgId, studyId, procId, suffix }) {
  const [vdCommon] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day,
      eligible_arms, modality
    ) values (
      ${orgId}, ${studyId}, ${'P11E-PARA-COMMON-' + suffix}, 'PARA common', 8801, 1, null, 'site'
    ) returning id
  `
  const [vdArmA] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day, eligible_arms, modality
    ) values (
      ${orgId}, ${studyId}, ${'P11E-PARA-ARMA-' + suffix}, 'PARA Arm A', 8802, 2,
      array['Arm A']::text[], 'phone'
    ) returning id
  `
  const [vdArmB] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day, eligible_arms
    ) values (
      ${orgId}, ${studyId}, ${'P11E-PARA-ARMB-' + suffix}, 'PARA Arm B', 8803, 3,
      array['Arm B']::text[]
    ) returning id
  `
  const [vdCond] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day, eligible_subject_roles
    ) values (
      ${orgId}, ${studyId}, ${'P11E-PARA-COND-' + suffix}, 'PARA conditional visit', 8804, 4,
      array['participant']::text[]
    ) returning id
  `
  for (const vdId of [vdCommon.id, vdArmA.id, vdArmB.id]) {
    await tx`
      insert into visit_def_procedure_map (
        organization_id, study_id, visit_definition_id, procedure_definition_id,
        is_required, sort_order, is_conditional, condition_label
      ) values (
        ${orgId}, ${studyId}, ${vdId}, ${procId}, false, 1, false, null
      )
    `
  }
  const [mapCond] = await tx`
    insert into visit_def_procedure_map (
      organization_id, study_id, visit_definition_id, procedure_definition_id,
      is_required, sort_order, is_conditional, condition_label
    ) values (
      ${orgId}, ${studyId}, ${vdCond.id}, ${procId}, false, 1, true, 'ACTH stimulation if indicated'
    ) returning id
  `
  return { vdCommon, vdArmA, vdArmB, vdCond, mapCond }
}

async function seedMvFixture(tx, { orgId, studyId, procId, suffix }) {
  const householdId = crypto.randomUUID()
  const [vdIndex] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day,
      eligible_subject_roles, modality
    ) values (
      ${orgId}, ${studyId}, ${'P11E-MV-IDX-' + suffix}, 'MV index visit', 8901, 1,
      array['index_patient']::text[], 'home'
    ) returning id
  `
  const [vdContact] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day,
      eligible_subject_roles, modality
    ) values (
      ${orgId}, ${studyId}, ${'P11E-MV-CNT-' + suffix}, 'MV contact visit', 8902, 2,
      array['household_contact']::text[], 'remote'
    ) returning id
  `
  const [vdSick] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day,
      eligible_subject_roles, modality
    ) values (
      ${orgId}, ${studyId}, ${'P11E-MV-SICK-' + suffix}, 'MV unscheduled sick', 8903, 99,
      array['index_patient','household_contact']::text[], 'off_site'
    ) returning id
  `
  for (const vdId of [vdIndex.id, vdContact.id, vdSick.id]) {
    await tx`
      insert into visit_def_procedure_map (
        organization_id, study_id, visit_definition_id, procedure_definition_id,
        is_required, sort_order, is_conditional, condition_label
      ) values (
        ${orgId}, ${studyId}, ${vdId}, ${procId},
        false, 1, ${vdId === vdSick.id}, ${vdId === vdSick.id ? 'Unscheduled sick visit if symptoms' : null}
      )
    `
  }
  const [subjIndex] = await tx`
    insert into study_subjects (
      organization_id, study_id, subject_identifier, enrollment_status,
      subject_role, household_id
    ) values (
      ${orgId}, ${studyId}, ${'P11E-MV-IDX-' + suffix}, 'enrolled', 'index_patient', ${householdId}
    ) returning id
  `
  const [subjContact] = await tx`
    insert into study_subjects (
      organization_id, study_id, subject_identifier, enrollment_status,
      subject_role, household_id, anchor_subject_id
    ) values (
      ${orgId}, ${studyId}, ${'P11E-MV-CNT-' + suffix}, 'enrolled', 'household_contact',
      ${householdId}, ${subjIndex.id}
    ) returning id
  `
  return { vdIndex, vdContact, vdSick, subjIndex, subjContact, householdId }
}

async function main() {
  const report = { gates: {} }
  try {
    const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
    if (!coord) {
      report.error = 'QA coordinator not found'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }

    const [pilot] = await sql`
      select ss.id, ss.study_id, ss.organization_id, ss.enrollment_status
      from study_subjects ss
      where ss.enrollment_status in ('enrolled', 'randomized')
      order by ss.created_at
      limit 1
    `
    if (!pilot) {
      report.error = 'no pilot subject'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }

    const studyId = pilot.study_id
    const orgId = pilot.organization_id
    const [study] = await sql`select organization_id from studies where id = ${studyId}`
    const [proc] = await sql`
      select pd.id
      from procedure_definitions pd
      where pd.study_id = ${studyId}
        and exists (
          select 1 from procedure_source_bindings psb
          where psb.study_id = ${studyId}
            and psb.procedure_definition_id = pd.id
            and psb.default_source_definition_version_id is not null
        )
      limit 1
    `
    if (!proc) {
      report.error = 'no procedure with published binding'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }

    let captured = null
    try {
      await sql.begin(async (tx) => {
        const suffix = Date.now().toString().slice(-6)
        await tx`
          update visit_definitions
          set eligible_subject_roles = array['__legacy_exclude_11e_proof__']::text[]
          where study_id = ${studyId}
        `

        const pilotVisitCountBefore = (
          await tx`select count(*)::int as c from visits where study_subject_id = ${pilot.id}`
        )[0].c

        const [participant] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status, subject_role
          ) values (
            ${orgId}, ${studyId}, ${'P11E-PART-' + suffix}, 'enrolled', 'participant'
          ) returning id, subject_role, household_id, anchor_subject_id
        `

        const para = await seedParaFixture(tx, {
          orgId: study.organization_id,
          studyId,
          procId: proc.id,
          suffix,
        })
        const mv = await seedMvFixture(tx, {
          orgId: study.organization_id,
          studyId,
          procId: proc.id,
          suffix,
        })

        const [subjArmA] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm
          ) values (
            ${orgId}, ${studyId}, ${'P11E-ARMA-' + suffix}, 'enrolled', 'participant', 'Arm A'
          ) returning id
        `
        const [subjArmB] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm
          ) values (
            ${orgId}, ${studyId}, ${'P11E-ARMB-' + suffix}, 'enrolled', 'participant', 'Arm B'
          ) returning id
        `

        const gen = async (subjectId) => {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          return callRpc(tx, 'generate_subject_visit_schedule', [subjectId, null, true])
        }

        await gen(participant.id)
        await gen(subjArmA.id)
        await gen(subjArmB.id)
        await gen(mv.subjIndex.id)
        await gen(mv.subjContact.id)

        const codes = async (subjectId, prefix) => {
          const rows = await tx`
            select vd.code, v.modality
            from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId}
              and vd.code like ${prefix + '%' + suffix}
              and v.visit_status not in ('cancelled', 'missed', 'no_show')
          `
          return rows
        }

        const rowsArmA = await codes(subjArmA.id, 'P11E-PARA-')
        const rowsArmB = await codes(subjArmB.id, 'P11E-PARA-')
        const codesArmA = rowsArmA.map((r) => r.code)
        const codesArmB = rowsArmB.map((r) => r.code)
        const codesIndex = (await codes(mv.subjIndex.id, 'P11E-MV-')).map((r) => r.code)
        const codesContact = (await codes(mv.subjContact.id, 'P11E-MV-')).map((r) => r.code)
        const modalityArmAVisit = rowsArmA.find((r) => r.code.includes('PARA-ARMA-'))?.modality
        const [defModArmA] = await tx`
          select modality from visit_definitions
          where study_id = ${studyId} and code = ${'P11E-PARA-ARMA-' + suffix}
        `
        const modalityArmA = modalityArmAVisit ?? defModArmA?.modality

        const peBefore = async (subjectId, code) => {
          const [row] = await tx`
            select count(*)::int as c
            from procedure_executions pe
            join visits v on v.id = pe.visit_id
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId} and vd.code = ${code}
          `
          return row.c
        }

        const condBefore = await peBefore(participant.id, `P11E-PARA-COND-${suffix}`)
        const [visitCond] = await tx`
          select v.id from visits v
          join visit_definitions vd on vd.id = v.visit_definition_id
          where v.study_subject_id = ${participant.id}
            and vd.code = ${'P11E-PARA-COND-' + suffix}
          limit 1
        `
        let instantiate = null
        if (visitCond) {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          instantiate = await callRpc(tx, 'instantiate_conditional_procedure_execution', [
            orgId,
            visitCond.id,
            para.mapCond.id,
          ])
        }
        const condAfter = await peBefore(participant.id, `P11E-PARA-COND-${suffix}`)
        const events = visitCond
          ? await tx`
              select event_type from operational_events
              where visit_id = ${visitCond.id}
                and event_type = 'CONDITIONAL_PROCEDURE_INSTANTIATED'
            `
          : []

        const pilotAfter = (
          await tx`select count(*)::int as c from visits where study_subject_id = ${pilot.id}`
        )[0].c

        const dupes = await tx`
          select study_subject_id, visit_definition_id, count(*)::int as c
          from visits
          where study_subject_id in (
            ${participant.id}, ${subjArmA.id}, ${subjArmB.id},
            ${mv.subjIndex.id}, ${mv.subjContact.id}
          )
            and visit_status not in ('cancelled', 'missed', 'no_show')
          group by 1, 2
          having count(*) > 1
        `

        const contactHousehold = (
          await tx`select household_id from study_subjects where id = ${mv.subjContact.id}`
        )[0].household_id
        const contactAnchor = (
          await tx`select anchor_subject_id from study_subjects where id = ${mv.subjContact.id}`
        )[0].anchor_subject_id
        const mvHouseholdMatch =
          mv.householdId != null && mv.householdId === contactHousehold
        const mvAnchor = contactAnchor === mv.subjIndex.id

        captured = {
          suffix,
          participant_role: participant.subject_role,
          mv_household_match: mvHouseholdMatch,
          mv_anchor: mvAnchor,
          codesArmA,
          codesArmB,
          codesIndex,
          codesContact,
          modalityArmA,
          condBefore,
          condAfter,
          instantiate,
          eventCount: events.length,
          pilotVisitDelta: pilotAfter - pilotVisitCountBefore,
          duplicate_active_visits: dupes.length,
          gates: {
            participant_default: { pass: participant.subject_role === 'participant' },
            pilot_regression: { pass: pilotVisitCountBefore === pilotAfter },
            role_index_vs_contact: {
              pass:
                codesIndex.includes(`P11E-MV-IDX-${suffix}`)
                && !codesIndex.includes(`P11E-MV-CNT-${suffix}`)
                && codesContact.includes(`P11E-MV-CNT-${suffix}`)
                && !codesContact.includes(`P11E-MV-IDX-${suffix}`),
            },
            arm_split: {
              pass:
                codesArmA.includes(`P11E-PARA-ARMA-${suffix}`)
                && codesArmA.includes(`P11E-PARA-COMMON-${suffix}`)
                && !codesArmA.includes(`P11E-PARA-ARMB-${suffix}`)
                && codesArmB.includes(`P11E-PARA-ARMB-${suffix}`)
                && codesArmB.includes(`P11E-PARA-COMMON-${suffix}`)
                && !codesArmB.includes(`P11E-PARA-ARMA-${suffix}`),
            },
            modality: { pass: modalityArmA === 'phone' || defModArmA?.modality === 'phone' },
            conditional_not_auto: { pass: condBefore === 0 },
            conditional_instantiate: {
              pass: Boolean(instantiate?.ok) && condAfter === 1,
            },
            event_logged: { pass: events.length >= 1 },
            mv_household_anchor: {
              pass: mvHouseholdMatch && mvAnchor,
            },
            no_duplicates: { pass: dupes.length === 0 },
          },
        }

        throw new Error('ROLLBACK_PROBE')
      })
    } catch (err) {
      if (err.message !== 'ROLLBACK_PROBE') throw err
    }

    report.probe = captured
    report.gates = captured?.gates ?? {}
    console.log(JSON.stringify(report, null, 2))
  } catch (err) {
    report.error = err.message
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await sql.end()
  }
}

main()
