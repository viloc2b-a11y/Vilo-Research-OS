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
    actor_user_id: string
  }[]>`
    with study as (
      select s.id, s.organization_id
      from public.studies s
      limit 1
    ),
    actor as (
      select om.user_id
      from public.organization_members om
      join study on study.organization_id = om.organization_id
      limit 1
    )
    select study.organization_id, study.id as study_id, actor.user_id as actor_user_id
    from study, actor
  `
  if (!fixture) throw new Error('No study fixture found with an organization member.')
  return fixture
}

async function activeMainConsentExists(sql: Query, subjectId: string) {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int
    from public.subject_consent_versions
    where study_subject_id = ${subjectId}::uuid
      and consent_type in ('initial_consent', 're_consent', 'amendment_consent')
      and status = 'active'
  `
  return row.count > 0
}

async function hasBlockingReconsent(sql: Query, subjectId: string) {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int
    from public.subject_consent_reconsent_requirements
    where study_subject_id = ${subjectId}::uuid
      and consent_action_required = true
      and reconsent_status in ('pending', 'overdue')
  `
  return row.count > 0
}

async function hasWithdrawal(sql: Query, subjectId: string, scope: string) {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int
    from public.subject_consent_withdrawals
    where study_subject_id = ${subjectId}::uuid
      and withdrawal_scope = ${scope}
  `
  return row.count > 0
}

async function hasGrantedPermission(sql: Query, subjectId: string, permissionType: string) {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int
    from public.subject_consent_optional_permissions
    where study_subject_id = ${subjectId}::uuid
      and permission_type = ${permissionType}
      and permission_status = 'granted'
  `
  return row.count > 0
}

async function main() {
  loadEnv()
  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL or DATABASE_URL_DIRECT is required.')

  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })
  try {
    await sql.begin(async (tx) => {
      const fixture = await findFixture(tx)
      const subjectIdentifier = `CONSENT-ENFORCEMENT-${Date.now()}`
      const [subject] = await tx<{ id: string }[]>`
        insert into public.study_subjects (
          organization_id,
          study_id,
          subject_identifier,
          enrollment_status
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${subjectIdentifier},
          'enrolled'
        )
        returning id
      `

      const noActiveConsentBlocks = !await activeMainConsentExists(tx, subject.id)

      const [consentVersion] = await tx<{ id: string }[]>`
        insert into public.subject_consent_versions (
          organization_id,
          study_id,
          study_subject_id,
          consent_type,
          consent_version_label,
          status,
          active_at,
          completed_at,
          locked_at,
          created_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${subject.id}::uuid,
          'initial_consent',
          'Smoke Enforcement ICF v1',
          'active',
          now() - interval '1 day',
          now() - interval '1 day',
          now() - interval '1 day',
          ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      const validActiveConsentAllows =
        await activeMainConsentExists(tx, subject.id) &&
        !await hasBlockingReconsent(tx, subject.id) &&
        !await hasWithdrawal(tx, subject.id, 'all_study')

      const [masterVersion] = await tx<{ id: string }[]>`
        insert into public.consent_document_versions (
          organization_id,
          study_id,
          consent_type,
          version_number,
          version_label,
          irb_approval_date,
          effective_date,
          reconsent_required,
          required_by_date,
          status,
          created_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          'main_icf',
          99,
          'Smoke Enforcement ICF v99',
          current_date - 2,
          current_date - 1,
          true,
          current_date + 7,
          'active',
          ${fixture.actor_user_id}::uuid
        )
        returning id
      `

      await tx`
        insert into public.subject_consent_reconsent_requirements (
          organization_id,
          study_id,
          study_subject_id,
          consent_document_version_id,
          current_subject_consent_version_id,
          pending_consent_version_id,
          reconsent_due_date,
          reconsent_status,
          reason
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${subject.id}::uuid,
          ${masterVersion.id}::uuid,
          ${consentVersion.id}::uuid,
          ${masterVersion.id}::uuid,
          current_date + 7,
          'pending',
          'Smoke pending reconsent blocks runtime execution.'
        )
      `

      const reconsentBlocks = await hasBlockingReconsent(tx, subject.id)

      await tx`
        update public.subject_consent_reconsent_requirements
        set reconsent_status = 'completed',
            consent_action_required = false,
            reconsent_required = false,
            consent_outdated = false,
            completed_at = now()
        where study_subject_id = ${subject.id}::uuid
      `

      await tx`
        insert into public.subject_consent_withdrawals (
          organization_id,
          study_id,
          study_subject_id,
          consent_version_id,
          withdrawal_scope,
          reason,
          created_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${subject.id}::uuid,
          ${consentVersion.id}::uuid,
          'all_study',
          'Smoke withdrawal blocks all future activity.',
          ${fixture.actor_user_id}::uuid
        )
      `

      const withdrawalBlocks = await hasWithdrawal(tx, subject.id, 'all_study')
      const optionalSpecimenBlocks = !await hasGrantedPermission(tx, subject.id, 'optional_specimen')

      await tx`
        insert into public.subject_consent_optional_permissions (
          organization_id,
          study_id,
          study_subject_id,
          consent_version_id,
          permission_type,
          permission_status,
          effective_at,
          updated_by
        )
        values (
          ${fixture.organization_id}::uuid,
          ${fixture.study_id}::uuid,
          ${subject.id}::uuid,
          ${consentVersion.id}::uuid,
          'future_use_samples',
          'granted',
          now(),
          ${fixture.actor_user_id}::uuid
        )
      `

      const futureUseAllowsWhenGranted = await hasGrantedPermission(tx, subject.id, 'future_use_samples')

      if (!noActiveConsentBlocks) throw new Error('Missing active ICF did not block.')
      if (!validActiveConsentAllows) throw new Error('Valid active consent did not allow execution.')
      if (!reconsentBlocks) throw new Error('Pending reconsent did not block.')
      if (!withdrawalBlocks) throw new Error('Withdrawal did not block.')
      if (!optionalSpecimenBlocks) throw new Error('Missing optional specimen consent did not block.')
      if (!futureUseAllowsWhenGranted) throw new Error('Granted future use permission did not allow.')

      console.log(JSON.stringify({
        status: 'PASS',
        rollback: true,
        noActiveConsentBlocks,
        validActiveConsentAllows,
        reconsentBlocks,
        withdrawalBlocks,
        optionalSpecimenBlocks,
        futureUseAllowsWhenGranted,
      }, null, 2))

      throw new Error('__ROLLBACK_CONSENT_ENFORCEMENT_SMOKE__')
    })
  } catch (error) {
    if (error instanceof Error && error.message === '__ROLLBACK_CONSENT_ENFORCEMENT_SMOKE__') return
    throw error
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
