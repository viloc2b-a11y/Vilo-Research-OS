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
    subject_id: string
    actor_user_id: string
  }[]>`
    with subject as (
      select id, organization_id, study_id
      from public.study_subjects
      where study_id is not null
      limit 1
    ),
    actor as (
      select om.user_id
      from public.organization_members om
      join subject on subject.organization_id = om.organization_id
      limit 1
    )
    select
      subject.organization_id,
      subject.study_id,
      subject.id as subject_id,
      actor.user_id as actor_user_id
    from subject, actor
  `
  if (!fixture) {
    throw new Error('No subject fixture found with an organization member in the same org.')
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

      const [version] = await tx<{ id: string }[]>`
        insert into public.subject_consent_versions (
          organization_id,
          study_id,
          study_subject_id,
          consent_type,
          consent_version_label,
          protocol_version,
          requires_pi_review,
          created_by,
          metadata
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${fixture.subject_id}::uuid,
          'initial_consent',
          'Smoke ICF v1',
          'Protocol Smoke',
          true,
          ${fixture.actor_user_id}::uuid,
          '{"rollback_smoke":true}'::jsonb
        )
        returning id
      `

      const [request] = await tx<{ id: string }[]>`
        insert into public.operational_signature_requests (
          organization_id,
          study_id,
          subject_id,
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
          ${fixture.subject_id}::uuid,
          'subject_consent_version',
          ${version.id}::uuid,
          'research_coordinator',
          'completed_by',
          ${fixture.actor_user_id}::uuid,
          '{"workflow":"subject_consent_runtime","rollback_smoke":true}'::jsonb
        )
        returning id
      `

      await tx`
        update public.subject_consent_versions
        set coordinator_signature_request_id = ${request.id}::uuid
        where id = ${version.id}::uuid
      `

      const [event] = await tx<{ id: string }[]>`
        insert into public.subject_consent_events (
          organization_id,
          study_id,
          study_subject_id,
          consent_version_id,
          event_type,
          event_status,
          signature_request_id,
          actor_user_id,
          metadata
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${fixture.subject_id}::uuid,
          ${version.id}::uuid,
          'signature_requested',
          'pending',
          ${request.id}::uuid,
          ${fixture.actor_user_id}::uuid,
          '{"rollback_smoke":true}'::jsonb
        )
        returning id
      `

      await tx`
        insert into public.subject_consent_documents (
          organization_id,
          study_id,
          study_subject_id,
          consent_version_id,
          consent_event_id,
          document_kind,
          file_name,
          file_path,
          linked_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${fixture.subject_id}::uuid,
          ${version.id}::uuid,
          ${event.id}::uuid,
          'icf',
          'smoke-icf.pdf',
          'consent/smoke-icf.pdf',
          ${fixture.actor_user_id}::uuid
        )
      `

      await tx`
        insert into public.subject_consent_optional_permissions (
          organization_id,
          study_id,
          study_subject_id,
          consent_version_id,
          permission_type,
          permission_status,
          changed_reason,
          updated_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${fixture.subject_id}::uuid,
          ${version.id}::uuid,
          'future_use_samples',
          'granted',
          'Smoke optional consent',
          ${fixture.actor_user_id}::uuid
        )
      `

      await tx`
        insert into public.subject_consent_audit (
          organization_id,
          study_id,
          study_subject_id,
          action,
          new_status,
          consent_version_id,
          consent_event_id,
          signature_request_id,
          actor_user_id,
          event_payload
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${fixture.subject_id}::uuid,
          'consent_signature_requested',
          'pending',
          ${version.id}::uuid,
          ${event.id}::uuid,
          ${request.id}::uuid,
          ${fixture.actor_user_id}::uuid,
          '{"rollback_smoke":true}'::jsonb
        )
      `

      const [assertion] = await tx<{
        version_status: string
        request_status: string
        event_count: number
        document_count: number
        permission_count: number
        audit_count: number
      }[]>`
        select
          v.status as version_status,
          r.status as request_status,
          (select count(*)::int from public.subject_consent_events e where e.consent_version_id = v.id) as event_count,
          (select count(*)::int from public.subject_consent_documents d where d.consent_version_id = v.id) as document_count,
          (select count(*)::int from public.subject_consent_optional_permissions p where p.consent_version_id = v.id) as permission_count,
          (select count(*)::int from public.subject_consent_audit a where a.consent_version_id = v.id) as audit_count
        from public.subject_consent_versions v
        join public.operational_signature_requests r on r.id = v.coordinator_signature_request_id
        where v.id = ${version.id}::uuid
      `

      if (assertion.version_status !== 'pending') throw new Error('Consent version is not pending.')
      if (assertion.request_status !== 'pending') throw new Error('Signature request is not pending.')
      if (assertion.event_count < 1) throw new Error('Consent event was not created.')
      if (assertion.document_count !== 1) throw new Error('Consent document was not linked.')
      if (assertion.permission_count !== 1) throw new Error('Optional permission was not created.')
      if (assertion.audit_count !== 1) throw new Error('Consent audit row was not created.')

      console.log(JSON.stringify({
        status: 'PASS',
        rollback: true,
        versionStatus: assertion.version_status,
        coordinatorSignatureRequestStatus: assertion.request_status,
        eventCount: assertion.event_count,
        documentCount: assertion.document_count,
        permissionCount: assertion.permission_count,
        auditCount: assertion.audit_count,
      }, null, 2))

      throw new Error('__ROLLBACK_CONSENT_SMOKE__')
    })
  } catch (error) {
    if (error instanceof Error && error.message === '__ROLLBACK_CONSENT_SMOKE__') return
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
