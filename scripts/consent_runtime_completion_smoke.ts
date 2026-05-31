import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
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
    select subject.organization_id, subject.study_id, subject.id as subject_id, actor.user_id as actor_user_id
    from subject, actor
  `
  if (!fixture) throw new Error('No subject fixture found.')
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

      const [v1] = await tx<{ id: string }[]>`
        insert into public.consent_document_versions (
          organization_id, study_id, consent_type, version_number, version_label,
          irb_approval_date, effective_date, reconsent_required, status, created_by
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, 'main_icf', 1, 'Smoke ICF v1',
          current_date - 60, current_date - 45, false, 'superseded', ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      const [subjectConsentV1] = await tx<{ id: string }[]>`
        insert into public.subject_consent_versions (
          organization_id, study_id, study_subject_id, consent_document_version_id,
          consent_type, consent_version_label, status, active_at, completed_at, locked_at, created_by
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid, ${v1.id}::uuid,
          'initial_consent', 'Smoke Subject ICF v1', 'active', now() - interval '30 days',
          now() - interval '30 days', now() - interval '30 days', ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      const [v2] = await tx<{ id: string }[]>`
        insert into public.consent_document_versions (
          organization_id, study_id, consent_type, version_number, version_label,
          irb_approval_date, effective_date, reconsent_required, required_by_date,
          amendment_identifier, status, optional_clause_changed, created_by
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, 'main_icf', 2, 'Smoke ICF v2',
          current_date - 5, current_date - 3, true, current_date + 7,
          'AMEND-SMOKE', 'active', true, ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      await tx`
        insert into public.consent_document_clauses (
          organization_id, study_id, consent_document_version_id, clause_type, clause_status,
          extracted_text, extraction_confidence, requires_optional_permission, requires_reconsent_on_change
        )
        values
          (${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${v2.id}::uuid, 'future_research_use', 'changed', 'Future research clause changed', 0.92, true, true),
          (${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${v2.id}::uuid, 'hipaa_authorization', 'present', 'HIPAA authorization present', 0.9, false, true)
      `

      await tx`
        insert into public.subject_consent_reconsent_requirements (
          organization_id, study_id, study_subject_id, consent_document_version_id,
          current_subject_consent_version_id, pending_consent_version_id, reconsent_due_date,
          reconsent_status, reason
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid, ${v2.id}::uuid,
          ${subjectConsentV1.id}::uuid, ${v2.id}::uuid, current_date + 7,
          'pending', 'Subject signed v1; required active version is v2.'
        )
      `

      const token = randomBytes(32).toString('base64url')
      const [session] = await tx<{ id: string }[]>`
        insert into public.subject_consent_patient_sessions (
          organization_id, study_id, study_subject_id, consent_document_version_id,
          token_hash, token_hint, language, expires_at, sent_at, created_by
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid, ${v2.id}::uuid,
          ${createHash('sha256').update(token).digest('hex')}, ${token.slice(0, 6)}, 'es',
          now() + interval '72 hours', now(), ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      await tx`
        insert into public.subject_consent_patient_signatures (
          organization_id, study_id, study_subject_id, patient_session_id, signer_type,
          signer_name, attestation_text
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid,
          ${session.id}::uuid, 'patient', 'Smoke Patient', 'I consent.'
        )
      `

      const [coordinatorRequest] = await tx<{ id: string }[]>`
        insert into public.operational_signature_requests (
          organization_id, study_id, subject_id, artifact_type, artifact_id, required_role,
          signature_meaning, requested_by, metadata
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid,
          'subject_consent_version', ${subjectConsentV1.id}::uuid, 'research_coordinator',
          'completed_by', ${fixture.actor_user_id}::uuid, '{"rollback_smoke":true}'::jsonb
        )
        returning id
      `

      const [piRequest] = await tx<{ id: string }[]>`
        insert into public.operational_signature_requests (
          organization_id, study_id, subject_id, artifact_type, artifact_id, required_role,
          signature_meaning, requested_by, metadata
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid,
          'subject_consent_version', ${subjectConsentV1.id}::uuid, 'pi_sub_i',
          'pi_review', ${fixture.actor_user_id}::uuid, '{"rollback_smoke":true}'::jsonb
        )
        returning id
      `

      const [v2SubjectConsent] = await tx<{ id: string }[]>`
        insert into public.subject_consent_versions (
          organization_id, study_id, study_subject_id, consent_document_version_id,
          consent_type, consent_version_label, status, active_at, completed_at, locked_at,
          coordinator_signature_request_id, pi_signature_request_id, requires_pi_review, created_by
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid, ${v2.id}::uuid,
          're_consent', 'Smoke Subject ICF v2', 'active', now(), now(), now(),
          ${coordinatorRequest.id}::uuid, ${piRequest.id}::uuid, true, ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      await tx`
        update public.subject_consent_reconsent_requirements
        set reconsent_status = 'completed',
            consent_outdated = false,
            reconsent_required = false,
            consent_action_required = false,
            current_subject_consent_version_id = ${v2SubjectConsent.id}::uuid,
            completed_at = now()
        where study_subject_id = ${fixture.subject_id}::uuid
          and consent_document_version_id = ${v2.id}::uuid
      `

      await tx`
        insert into public.subject_consent_withdrawals (
          organization_id, study_id, study_subject_id, consent_version_id,
          withdrawal_scope, reason, created_by
        )
        values (
          ${fixture.organization_id}::uuid, ${fixture.study_id}::uuid, ${fixture.subject_id}::uuid,
          ${v2SubjectConsent.id}::uuid, 'future_use', 'Smoke withdrawal of future use', ${fixture.actor_user_id}::uuid
        )
      `

      const [assertion] = await tx<{
        master_count: number
        clause_count: number
        queue_completed: number
        patient_session_count: number
        patient_signature_count: number
        pending_signature_requests: number
        withdrawal_count: number
      }[]>`
        select
          (select count(*)::int from public.consent_document_versions where id in (${v1.id}::uuid, ${v2.id}::uuid)) as master_count,
          (select count(*)::int from public.consent_document_clauses where consent_document_version_id = ${v2.id}::uuid) as clause_count,
          (select count(*)::int from public.subject_consent_reconsent_requirements where consent_document_version_id = ${v2.id}::uuid and reconsent_status = 'completed') as queue_completed,
          (select count(*)::int from public.subject_consent_patient_sessions where id = ${session.id}::uuid and expires_at > now()) as patient_session_count,
          (select count(*)::int from public.subject_consent_patient_signatures where patient_session_id = ${session.id}::uuid) as patient_signature_count,
          (select count(*)::int from public.operational_signature_requests where id in (${coordinatorRequest.id}::uuid, ${piRequest.id}::uuid) and status = 'pending') as pending_signature_requests,
          (select count(*)::int from public.subject_consent_withdrawals where withdrawal_scope = 'future_use' and study_subject_id = ${fixture.subject_id}::uuid) as withdrawal_count
      `

      if (assertion.master_count !== 2) throw new Error('Master consent versions not created.')
      if (assertion.clause_count !== 2) throw new Error('Consent clauses not persisted.')
      if (assertion.queue_completed !== 1) throw new Error('Reconsent completion did not clear queue.')
      if (assertion.patient_session_count !== 1) throw new Error('Patient eConsent session not created.')
      if (assertion.patient_signature_count !== 1) throw new Error('Patient signature not created.')
      if (assertion.pending_signature_requests !== 2) throw new Error('Staff/PI signature requests not pending.')
      if (assertion.withdrawal_count !== 1) throw new Error('Withdrawal scope not recorded.')

      console.log(JSON.stringify({
        status: 'PASS',
        rollback: true,
        ...assertion,
      }, null, 2))

      throw new Error('__ROLLBACK_CONSENT_COMPLETION_SMOKE__')
    })
  } catch (error) {
    if (error instanceof Error && error.message === '__ROLLBACK_CONSENT_COMPLETION_SMOKE__') return
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
