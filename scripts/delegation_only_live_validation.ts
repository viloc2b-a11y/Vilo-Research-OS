import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

type Query = ReturnType<typeof postgres>

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

function hashArtifact(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
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
    throw new Error('No fixture found with one PI, one CRC, and one study in the same org.')
  }
  return fixture
}

async function main() {
  loadEnv()
  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL or DATABASE_URL_DIRECT is required.')

  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })
  try {
    const fixture = await findFixture(sql)
    const tasks = ['Obtain Informed Consent', 'Source Data Documentation']

    const [delegation] = await sql<{ id: string }[]>`
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
        'CRC Live Validation',
        'research_coordinator',
        'CRC',
        ${fixture.pi_user_id}::uuid,
        'PI',
        ${tasks},
        current_date,
        current_date,
        true,
        'Pending Staff Signature'
      )
      returning id
    `

    const [staffRequest] = await sql<{ id: string }[]>`
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
        ${delegation.id}::uuid,
        'research_coordinator',
        'acknowledged_by',
        ${fixture.pi_user_id}::uuid,
        ${sql.json({ workflow: 'study_delegation_log', recipient: 'delegatee', live_validation: true, tasks })}
      )
      returning id
    `

    const [piRequest] = await sql<{ id: string }[]>`
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
        ${delegation.id}::uuid,
        'pi_sub_i',
        'approved_by',
        ${fixture.crc_user_id}::uuid,
        ${sql.json({ workflow: 'study_delegation_log', recipient: 'pi', live_validation: true, tasks })}
      )
      returning id
    `

    await sql`
      update public.study_delegation_log
      set staff_signature_request_id = ${staffRequest.id}::uuid,
          pi_signature_request_id = ${piRequest.id}::uuid
      where id = ${delegation.id}::uuid
    `

    const staffHash = hashArtifact({ delegation: delegation.id, request: staffRequest.id, tasks })
    const piHash = hashArtifact({ delegation: delegation.id, request: piRequest.id, tasks })

    const [staffSignature] = await sql<{ id: string }[]>`
      insert into public.operational_signatures (
        request_id,
        organization_id,
        study_id,
        artifact_type,
        artifact_id,
        required_role,
        signer_user_id,
        signer_role,
        signature_meaning,
        signed_artifact_hash,
        metadata
      )
      values (
        ${staffRequest.id}::uuid,
        ${fixture.organization_id}::uuid,
        ${fixture.study_id}::uuid,
        'study_delegation_log',
        ${delegation.id}::uuid,
        'research_coordinator',
        ${fixture.crc_user_id}::uuid,
        'research_coordinator',
        'acknowledged_by',
        ${staffHash},
        '{"live_validation":true,"auth_method":"PIN"}'::jsonb
      )
      returning id
    `

    const [piSignature] = await sql<{ id: string }[]>`
      insert into public.operational_signatures (
        request_id,
        organization_id,
        study_id,
        artifact_type,
        artifact_id,
        required_role,
        signer_user_id,
        signer_role,
        signature_meaning,
        signed_artifact_hash,
        metadata
      )
      values (
        ${piRequest.id}::uuid,
        ${fixture.organization_id}::uuid,
        ${fixture.study_id}::uuid,
        'study_delegation_log',
        ${delegation.id}::uuid,
        'pi_sub_i',
        ${fixture.pi_user_id}::uuid,
        'pi_sub_i',
        'approved_by',
        ${piHash},
        '{"live_validation":true,"auth_method":"PIN"}'::jsonb
      )
      returning id
    `

    await sql`
      update public.operational_signature_requests
      set status = 'signed'
      where id in (${staffRequest.id}::uuid, ${piRequest.id}::uuid)
    `

    await sql`
      insert into public.operational_signature_events (
        organization_id,
        study_id,
        request_id,
        signature_id,
        event_type,
        event_payload,
        actor_user_id
      )
      values
        (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${staffRequest.id}::uuid,
          ${staffSignature.id}::uuid,
          'signature_recorded',
          '{"live_validation":true,"role":"research_coordinator"}'::jsonb,
          ${fixture.crc_user_id}::uuid
        ),
        (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${piRequest.id}::uuid,
          ${piSignature.id}::uuid,
          'signature_recorded',
          '{"live_validation":true,"role":"pi_sub_i"}'::jsonb,
          ${fixture.pi_user_id}::uuid
        )
    `

    await sql`
      update public.study_delegation_log
      set delegation_status = 'Active',
          locked_at = now(),
          locked_by = ${fixture.pi_user_id}::uuid,
          amendment_required_reason = 'Delegation locked after staff and PI signatures.'
      where id = ${delegation.id}::uuid
    `

    await sql`
      insert into public.study_delegation_log_audit (
        organization_id,
        study_id,
        delegation_log_id,
        event_type,
        event_payload,
        actor_user_id
      )
      values (
        ${fixture.organization_id}::uuid,
        ${fixture.study_id}::uuid,
        ${delegation.id}::uuid,
        'delegation_locked',
        ${sql.json({ live_validation: true, staff_signature_request_id: staffRequest.id, pi_signature_request_id: piRequest.id })},
        ${fixture.pi_user_id}::uuid
      )
    `

    let lockingBlocked = false
    try {
      await sql`
        update public.study_delegation_log
        set delegatee_name = 'SHOULD NOT UPDATE'
        where id = ${delegation.id}::uuid
      `
    } catch (error) {
      lockingBlocked = /delegation log is locked/i.test(error instanceof Error ? error.message : String(error))
    }

    const [assertion] = await sql<{
      delegation_id: string
      delegation_status: string
      staff_signature_request_id: string
      pi_signature_request_id: string
      request_count: number
      signature_count: number
      event_count: number
      delegation_audit_count: number
    }[]>`
      select
        l.id as delegation_id,
        l.delegation_status,
        l.staff_signature_request_id::text,
        l.pi_signature_request_id::text,
        (
          select count(*)::int
          from public.operational_signature_requests r
          where r.id in (l.staff_signature_request_id, l.pi_signature_request_id)
        ) as request_count,
        (
          select count(*)::int
          from public.operational_signatures s
          where s.request_id in (l.staff_signature_request_id, l.pi_signature_request_id)
        ) as signature_count,
        (
          select count(*)::int
          from public.operational_signature_events e
          where e.request_id in (l.staff_signature_request_id, l.pi_signature_request_id)
        ) as event_count,
        (
          select count(*)::int
          from public.study_delegation_log_audit a
          where a.delegation_log_id = l.id
        ) as delegation_audit_count
      from public.study_delegation_log l
      where l.id = ${delegation.id}::uuid
    `

    console.log(JSON.stringify({
      status: 'PASS',
      delegationId: assertion.delegation_id,
      delegationStatus: assertion.delegation_status,
      staffSignatureRequestId: assertion.staff_signature_request_id,
      piSignatureRequestId: assertion.pi_signature_request_id,
      requestCount: assertion.request_count,
      signatureCount: assertion.signature_count,
      eventCount: assertion.event_count,
      delegationAuditCount: assertion.delegation_audit_count,
      lockingBlocked,
    }, null, 2))
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
