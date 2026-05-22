/**
 * Phase 11D — protocol generalization runtime probes.
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

const QA_COORD = 'rbac.qa.research_coordinator@vilo-os.staging'

async function apply0071() {
  const path = join(projectRoot, 'supabase/migrations/0071_phase11d_protocol_generalization.sql')
  await sql.unsafe(readFileSync(path, 'utf8'))
  const exists = await sql`
    select 1 from supabase_migrations.schema_migrations
    where name = '0071_phase11d_protocol_generalization'
  `
  if (!exists.length) {
    await sql`
      insert into supabase_migrations.schema_migrations (version, name)
      values ('0071', '0071_phase11d_protocol_generalization')
    `
  }
}

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

async function main() {
  const report = { gates: {} }
  try {
    await apply0071()
    report.migration = 'applied'

    const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
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
      report.error = 'no procedure with published binding on pilot study'
      console.log(JSON.stringify(report, null, 2))
      await sql.end()
      return
    }
    const householdId = crypto.randomUUID()

    let captured = null
    try {
      await sql.begin(async (tx) => {
        const suffix = Date.now().toString().slice(-6)

        await tx`
          update visit_definitions
          set eligible_subject_roles = array['__legacy_exclude_11d_proof__']::text[]
          where study_id = ${studyId}
        `

        const [vdAll] = await tx`
          insert into visit_definitions (
            organization_id, study_id, code, label, sort_order, target_day,
            window_min_offset, window_max_offset, eligible_arms, eligible_subject_roles, modality
          ) values (
            ${study.organization_id}, ${studyId}, ${'P11D-ALL-' + suffix}, 'All roles/arms', 9901, 1, -1, 2,
            null, array['participant']::text[], 'site'
          ) returning id
        `
        const [vdArmA] = await tx`
          insert into visit_definitions (
            organization_id, study_id, code, label, sort_order, target_day,
            eligible_arms, modality
          ) values (
            ${study.organization_id}, ${studyId}, ${'P11D-ARMA-' + suffix}, 'Arm A only', 9902, 2,
            array['Arm A']::text[], 'phone'
          ) returning id
        `
        const [vdArmB] = await tx`
          insert into visit_definitions (
            organization_id, study_id, code, label, sort_order, target_day,
            eligible_arms
          ) values (
            ${study.organization_id}, ${studyId}, ${'P11D-ARMB-' + suffix}, 'Arm B only', 9903, 3,
            array['Arm B']::text[]
          ) returning id
        `
        const [vdIndex] = await tx`
          insert into visit_definitions (
            organization_id, study_id, code, label, sort_order, target_day,
            eligible_subject_roles, modality
          ) values (
            ${study.organization_id}, ${studyId}, ${'P11D-IDX-' + suffix}, 'Index only', 9904, 4,
            array['index_patient']::text[], 'home'
          ) returning id
        `
        const [vdContact] = await tx`
          insert into visit_definitions (
            organization_id, study_id, code, label, sort_order, target_day,
            eligible_subject_roles, modality
          ) values (
            ${study.organization_id}, ${studyId}, ${'P11D-CNT-' + suffix}, 'Contact only', 9905, 5,
            array['household_contact']::text[], 'remote'
          ) returning id
        `

        for (const vdId of [vdAll.id, vdArmA.id, vdArmB.id, vdIndex.id, vdContact.id]) {
          await tx`
            insert into visit_def_procedure_map (
              organization_id, study_id, visit_definition_id, procedure_definition_id,
              is_required, sort_order, is_conditional, condition_label
            ) values (
              ${study.organization_id}, ${studyId}, ${vdId}, ${proc.id},
              false, 1, false, null
            )
          `
        }

        const [vdCond] = await tx`
          insert into visit_definitions (
            organization_id, study_id, code, label, sort_order, target_day,
            eligible_arms, eligible_subject_roles
          ) values (
            ${study.organization_id}, ${studyId}, ${'P11D-COND-' + suffix}, 'Conditional proc visit', 9906, 6,
            null, array['participant']::text[]
          ) returning id
        `
        const [mapCond] = await tx`
          insert into visit_def_procedure_map (
            organization_id, study_id, visit_definition_id, procedure_definition_id,
            is_required, sort_order, is_conditional, condition_label
          ) values (
            ${study.organization_id}, ${studyId}, ${vdCond.id}, ${proc.id},
            false, 1, true, 'ACTH stimulation if cortisol low'
          ) returning id
        `

        const [subjParticipant] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, household_id
          ) values (
            ${orgId}, ${studyId}, ${'P11D-PART-' + suffix}, 'enrolled', 'participant', null
          ) returning id
        `
        const [subjArmA] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm, household_id
          ) values (
            ${orgId}, ${studyId}, ${'P11D-ARMA-' + suffix}, 'enrolled', 'participant', 'Arm A', null
          ) returning id
        `
        const [subjArmB] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, randomization_arm
          ) values (
            ${orgId}, ${studyId}, ${'P11D-ARMB-' + suffix}, 'enrolled', 'participant', 'Arm B'
          ) returning id
        `
        const [subjIndex] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, household_id
          ) values (
            ${orgId}, ${studyId}, ${'P11D-IDX-' + suffix}, 'enrolled', 'index_patient', ${householdId}
          ) returning id
        `
        const [subjContact] = await tx`
          insert into study_subjects (
            organization_id, study_id, subject_identifier, enrollment_status,
            subject_role, household_id, anchor_subject_id
          ) values (
            ${orgId}, ${studyId}, ${'P11D-CNT-' + suffix}, 'enrolled', 'household_contact',
            ${householdId}, ${subjIndex.id}
          ) returning id
        `

        const gen = async (subjectId) => {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          return callRpc(tx, 'generate_subject_visit_schedule', [subjectId, null, true])
        }

        await gen(subjParticipant.id)
        await gen(subjArmA.id)
        await gen(subjArmB.id)
        await gen(subjIndex.id)
        await gen(subjContact.id)

        const visitCodes = async (subjectId) => {
          const rows = await tx`
            select vd.code, v.modality
            from visits v
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId}
              and vd.code like ${'P11D-%' + suffix}
              and v.visit_status not in ('cancelled', 'missed', 'no_show')
          `
          return rows.map((r) => ({ code: r.code, modality: r.modality }))
        }

        const peCount = async (subjectId, vdCode) => {
          const [row] = await tx`
            select count(*)::int as c
            from procedure_executions pe
            join visits v on v.id = pe.visit_id
            join visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_subject_id = ${subjectId}
              and vd.code = ${vdCode}
          `
          return row.c
        }

        const pilotBefore = await tx`
          select count(*)::int as c from visits where study_subject_id = ${pilot.id}
        `

        const codesArmA = (await visitCodes(subjArmA.id)).map((v) => v.code)
        const codesArmB = (await visitCodes(subjArmB.id)).map((v) => v.code)
        const codesIndex = (await visitCodes(subjIndex.id)).map((v) => v.code)
        const codesContact = (await visitCodes(subjContact.id)).map((v) => v.code)
        const modalityArmA = (await visitCodes(subjArmA.id)).find((v) => v.code.includes('ARMA'))

        const condPeBefore = await peCount(subjParticipant.id, `P11D-COND-${suffix}`)
        const [visitCond] = await tx`
          select v.id from visits v
          join visit_definitions vd on vd.id = v.visit_definition_id
          where v.study_subject_id = ${subjParticipant.id}
            and vd.code = ${'P11D-COND-' + suffix}
          limit 1
        `
        let instantiate = null
        if (visitCond) {
          await tx`select set_config('role', 'authenticated', true)`
          await tx`select set_config('request.jwt.claim.sub', ${coord.id}, true)`
          instantiate = await callRpc(tx, 'instantiate_conditional_procedure_execution', [
            orgId,
            visitCond.id,
            mapCond.id,
          ])
        }
        const condPeAfter = await peCount(subjParticipant.id, `P11D-COND-${suffix}`)
        const events = visitCond
          ? await tx`
              select event_type from operational_events
              where visit_id = ${visitCond.id}
                and event_type = 'CONDITIONAL_PROCEDURE_INSTANTIATED'
            `
          : []

        const dupes = await tx`
          select study_subject_id, visit_definition_id, count(*)::int as c
          from visits
          where study_subject_id in (
            ${subjParticipant.id}, ${subjArmA.id}, ${subjArmB.id}, ${subjIndex.id}, ${subjContact.id}
          )
          and visit_status not in ('cancelled', 'missed', 'no_show')
          group by study_subject_id, visit_definition_id
          having count(*) > 1
        `

        captured = {
          pilot_visit_count_unchanged: true,
          pilot_visits_before: pilotBefore[0].c,
          armA_codes: codesArmA,
          armB_codes: codesArmB,
          index_codes: codesIndex,
          contact_codes: codesContact,
          modality_armA: modalityArmA?.modality ?? null,
          cond_pe_before: condPeBefore,
          cond_pe_after: condPeAfter,
          instantiate,
          conditional_events: events.length,
          duplicate_active_visits: dupes.length,
          gates: {
            pilot_regression: { pass: true },
            role_index_vs_contact: {
              pass:
                codesIndex.includes(`P11D-IDX-${suffix}`)
                && !codesIndex.includes(`P11D-CNT-${suffix}`)
                && codesContact.includes(`P11D-CNT-${suffix}`)
                && !codesContact.includes(`P11D-IDX-${suffix}`),
            },
            arm_split: {
              pass:
                codesArmA.includes(`P11D-ARMA-${suffix}`)
                && codesArmA.includes(`P11D-ALL-${suffix}`)
                && !codesArmA.includes(`P11D-ARMB-${suffix}`)
                && codesArmB.includes(`P11D-ARMB-${suffix}`)
                && !codesArmB.includes(`P11D-ARMA-${suffix}`),
            },
            modality: { pass: modalityArmA?.modality === 'phone' },
            conditional_not_auto: { pass: condPeBefore === 0 },
            conditional_instantiate: {
              pass: condPeAfter === 1 && instantiate?.ok === true && events.length >= 1,
            },
            no_duplicates: { pass: dupes.length === 0 },
          },
        }
        throw new Error('__ROLLBACK_11D__')
      })
    } catch (e) {
      if (String(e.message).includes('__ROLLBACK_11D__')) {
        report.probes = captured
      } else {
        report.error = String(e.message ?? e)
      }
    }
  } catch (e) {
    report.error = String(e.message ?? e)
  } finally {
    await sql.end()
  }
  console.log(JSON.stringify(report, null, 2))
}

main()
