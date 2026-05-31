import { readFileSync } from 'node:fs'
import postgres from 'postgres'

type Query = postgres.Sql | postgres.TransactionSql

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([^#=]+)=(.*)$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
        }
      }
    } catch {
      // optional
    }
  }
}

async function findFixture(sql: Query) {
  const [fixture] = await sql<{
    organization_id: string
    study_id: string
    trainee_user_id: string
    trainer_user_id: string
  }[]>`
    with trainee as (
      select om.organization_id, om.user_id
      from public.organization_members om
      where om.role = 'research_coordinator'
         or 'research_coordinator' = any(coalesce(om.roles, '{}'))
      limit 1
    ),
    trainer as (
      select om.organization_id, om.user_id
      from public.organization_members om
      join trainee on trainee.organization_id = om.organization_id
      where om.role = 'pi_sub_i' or 'pi_sub_i' = any(coalesce(om.roles, '{}'))
      limit 1
    ),
    study as (
      select s.id, s.organization_id
      from public.studies s
      join trainee on trainee.organization_id = s.organization_id
      limit 1
    )
    select
      study.organization_id,
      study.id as study_id,
      trainee.user_id as trainee_user_id,
      trainer.user_id as trainer_user_id
    from study, trainee, trainer
  `
  if (!fixture) {
    throw new Error('No fixture found with one trainee, one trainer/PI, and one study in the same org.')
  }
  return fixture
}

async function main() {
  loadEnv()
  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL or DATABASE_URL_DIRECT is required.')

  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })
  try {
    await sql.begin(async (tx) => {
      const fixture = await findFixture(tx)

      const [item] = await tx<{ id: string }[]>`
        insert into public.study_training_items (
          organization_id,
          study_id,
          training_type,
          training_topic,
          training_material_title,
          trainer_user_id,
          trainer_name,
          trainer_initials,
          requires_trainer_signature,
          requires_pi_acknowledgment,
          certificate_expected,
          created_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          'Protocol-Specific Training',
          'Protocol-Specific Training',
          'Smoke protocol training material',
          ${fixture.trainer_user_id}::uuid,
          'PI Smoke Trainer',
          'PI',
          true,
          true,
          false,
          ${fixture.trainer_user_id}::uuid
        )
        returning id
      `

      const [assignment] = await tx<{ id: string }[]>`
        insert into public.study_training_assignments (
          organization_id,
          study_id,
          training_item_id,
          trainee_user_id,
          trainee_name,
          trainee_role,
          trainee_initials,
          assigned_by,
          due_date,
          training_status
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${item.id}::uuid,
          ${fixture.trainee_user_id}::uuid,
          'CRC Smoke Trainee',
          'research_coordinator',
          'CRC',
          ${fixture.trainer_user_id}::uuid,
          current_date + 7,
          'Assigned'
        )
        returning id
      `

      const [request] = await tx<{ id: string }[]>`
        insert into public.operational_signature_requests (
          organization_id,
          study_id,
          artifact_type,
          artifact_id,
          required_role,
          signature_meaning,
          requested_by,
          metadata
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          'study_training_assignment',
          ${assignment.id}::uuid,
          'research_coordinator',
          'acknowledged_by',
          ${fixture.trainer_user_id}::uuid,
          '{"workflow":"study_training_log","rollback_smoke":true}'::jsonb
        )
        returning id
      `

      await tx`
        update public.study_training_assignments
        set trainee_signature_request_id = ${request.id}::uuid,
            training_status = 'Pending Trainee Signature'
        where id = ${assignment.id}::uuid
      `

      await tx`
        insert into public.study_training_assignment_audit (
          organization_id,
          study_id,
          training_assignment_id,
          event_type,
          event_payload,
          actor_user_id
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${assignment.id}::uuid,
          'trainee_signature_requested',
          '{"rollback_smoke":true}'::jsonb,
          ${fixture.trainer_user_id}::uuid
        )
      `

      const [assertion] = await tx<{
        assignment_status: string
        request_status: string
        audit_count: number
      }[]>`
        select
          a.training_status as assignment_status,
          r.status as request_status,
          (
            select count(*)::int
            from public.study_training_assignment_audit audit
            where audit.training_assignment_id = a.id
          ) as audit_count
        from public.study_training_assignments a
        join public.operational_signature_requests r on r.id = a.trainee_signature_request_id
        where a.id = ${assignment.id}::uuid
      `

      if (assertion.assignment_status !== 'Pending Trainee Signature') {
        throw new Error('Training assignment did not move to Pending Trainee Signature.')
      }
      if (assertion.request_status !== 'pending') {
        throw new Error('Trainee signature request is not pending.')
      }
      if (assertion.audit_count !== 1) {
        throw new Error('Training audit event was not created.')
      }

      console.log(JSON.stringify({
        status: 'PASS',
        rollback: true,
        assignmentStatus: assertion.assignment_status,
        traineeSignatureRequestStatus: assertion.request_status,
        auditCount: assertion.audit_count,
      }, null, 2))

      throw new Error('__ROLLBACK_TRAINING_SMOKE__')
    })
  } catch (error) {
    if (error instanceof Error && error.message === '__ROLLBACK_TRAINING_SMOKE__') return
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
