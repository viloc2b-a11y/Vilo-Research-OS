import { readFileSync } from 'node:fs'
import postgres from 'postgres'

type Query = ReturnType<typeof postgres>

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=]+)=(.*)$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Local smoke can still run when the caller provides DATABASE_URL directly.
  }
}

async function findFixture(sql: Query) {
  const [fixture] = await sql<{
    organization_id: string
    study_id: string
    pi_user_id: string
    crc_user_id: string
  }[]>`
    with pi as (
      select om.organization_id, om.user_id
      from public.organization_members om
      where om.role = 'pi_sub_i' or 'pi_sub_i' = any(coalesce(om.roles, '{}'))
      limit 1
    ),
    crc as (
      select om.organization_id, om.user_id
      from public.organization_members om
      join pi on pi.organization_id = om.organization_id
      where om.role = 'research_coordinator'
         or 'research_coordinator' = any(coalesce(om.roles, '{}'))
      limit 1
    ),
    study as (
      select s.id, s.organization_id
      from public.studies s
      join pi on pi.organization_id = s.organization_id
      limit 1
    )
    select
      study.organization_id,
      study.id as study_id,
      pi.user_id as pi_user_id,
      crc.user_id as crc_user_id
    from study, pi, crc
  `

  if (!fixture) {
    throw new Error('No staging fixture found with one PI, one CRC, and one study in the same org.')
  }
  return fixture
}

async function ensureSmokeColumns(sql: Query) {
  await sql`
    alter table public.study_delegation_log
      add column if not exists delegatee_name text,
      add column if not exists pi_initials text,
      add column if not exists task_labels text[] not null default '{}'::text[],
      add column if not exists locked_at timestamptz,
      add column if not exists locked_by uuid references auth.users(id) on delete set null,
      add column if not exists isf_location text not null default 'Investigator and Site Documentation',
      add column if not exists document_version text not null default '1.0',
      add column if not exists date_created date not null default current_date,
      add column if not exists last_updated date not null default current_date
  `
}

async function main() {
  loadEnv()
  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL or DATABASE_URL_DIRECT is required.')

  const sql = postgres(dbUrl, {
    ssl: 'require',
    max: 1,
    prepare: false,
  })

  try {
    await sql.begin(async (tx) => {
      const fixture = await findFixture(tx)
      await ensureSmokeColumns(tx)

      const [crcDelegation] = await tx<{ id: string }[]>`
        insert into public.study_delegation_log (
          organization_id,
          study_id,
          staff_user_id,
          delegatee_name,
          staff_role,
          staff_initials,
          pi_delegator_id,
          pi_initials,
          task_labels,
          delegation_date,
          delegation_start_date,
          is_ongoing,
          delegation_status
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${fixture.crc_user_id}::uuid,
          'CRC Smoke User',
          'research_coordinator',
          'CRC',
          ${fixture.pi_user_id}::uuid,
          'PI',
          array['Obtain Informed Consent', 'Source Data Documentation'],
          current_date,
          current_date,
          true,
          'Pending Staff Signature'
        )
        returning id
      `

      const [crcRequest] = await tx<{ id: string }[]>`
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
          'study_delegation_log',
          ${crcDelegation.id}::uuid,
          'research_coordinator',
          'acknowledged_by',
          ${fixture.pi_user_id}::uuid,
          '{"workflow":"study_delegation_log","recipient":"delegatee"}'::jsonb
        )
        returning id
      `
      const [piRequest] = await tx<{ id: string }[]>`
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
          'study_delegation_log',
          ${crcDelegation.id}::uuid,
          'pi_sub_i',
          'approved_by',
          ${fixture.crc_user_id}::uuid,
          '{"workflow":"study_delegation_log","recipient":"pi"}'::jsonb
        )
        returning id
      `

      await tx`
        update public.study_delegation_log
        set staff_signature_request_id = ${crcRequest.id}::uuid,
            pi_signature_request_id = ${piRequest.id}::uuid
        where id = ${crcDelegation.id}::uuid
      `

      const [assertion] = await tx<{ task_count: number; staff_request: string; pi_request: string }[]>`
        select
          array_length(l.task_labels, 1)::int as task_count,
          staff_sig.status as staff_request,
          pi_sig.status as pi_request
        from public.study_delegation_log l
        join public.operational_signature_requests staff_sig on staff_sig.id = l.staff_signature_request_id
        join public.operational_signature_requests pi_sig on pi_sig.id = l.pi_signature_request_id
        where l.id = ${crcDelegation.id}::uuid
      `

      if (assertion.task_count !== 2) throw new Error('Delegated task count did not persist.')
      if (assertion.staff_request !== 'pending') throw new Error('Delegatee signature request is not pending.')
      if (assertion.pi_request !== 'pending') throw new Error('PI signature request is not pending.')

      console.log(JSON.stringify({
        status: 'PASS',
        rollback: true,
        delegatedTo: 'research_coordinator',
        delegatedTasks: assertion.task_count,
        delegateeSignatureStatus: assertion.staff_request,
        piSignatureStatus: assertion.pi_request,
      }, null, 2))

      throw new Error('__ROLLBACK_SMOKE__')
    })
  } catch (error) {
    if (error instanceof Error && error.message === '__ROLLBACK_SMOKE__') return
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message || error.name || JSON.stringify(error))
  } else {
    console.error(JSON.stringify(error))
  }
  process.exit(1)
})
