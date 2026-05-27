/**
 * Live staging DB checks for operational eSignature boundaries (post-0133/0134).
 * Usage: node scripts/staging-live-esignature-boundaries.mjs
 */
import postgres from 'postgres'
import { loadEnvFiles } from './lib/env.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function expectDbError(label, fn, pattern) {
  try {
    await fn()
    throw new Error(`${label}: expected failure`)
  } catch (err) {
    const msg = String(err.message || err)
    if (pattern && !pattern.test(msg)) {
      throw new Error(`${label}: unexpected error: ${msg}`)
    }
    return msg
  }
}

async function main() {
  loadEnvFiles()
  const url = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
  }

  const sql = postgres(url, { ssl: 'require', max: 1, prepare: false })

  try {
    const [org] = await sql`select id from public.organizations limit 1`
    const [study] = await sql`
      select id from public.studies where organization_id = ${org.id} limit 1
    `
    assert(org && study, 'Need at least one organization and study in staging')

    const artifactId = crypto.randomUUID()
    const requestBase = {
      organization_id: org.id,
      study_id: study.id,
      artifact_type: 'operational_signature_test_fixture',
      artifact_id: artifactId,
      required_role: 'pi_sub_i',
      signature_meaning: 'reviewed_by',
      status: 'pending',
      metadata: { live_boundary_test: true },
    }

    const [req1] = await sql`
      insert into public.operational_signature_requests (
        organization_id, study_id, artifact_type, artifact_id,
        required_role, signature_meaning, status, metadata
      ) values (
        ${requestBase.organization_id},
        ${requestBase.study_id},
        ${requestBase.artifact_type},
        ${requestBase.artifact_id},
        ${requestBase.required_role},
        ${requestBase.signature_meaning},
        ${requestBase.status},
        ${sql.json(requestBase.metadata)}
      )
      returning id
    `
    console.log('OK created pending signature request')

    await expectDbError(
      'duplicate pending request',
      () => sql`
        insert into public.operational_signature_requests (
          organization_id, study_id, artifact_type, artifact_id,
          required_role, signature_meaning, status, metadata
        ) values (
          ${requestBase.organization_id},
          ${requestBase.study_id},
          ${requestBase.artifact_type},
          ${requestBase.artifact_id},
          ${requestBase.required_role},
          ${requestBase.signature_meaning},
          'pending',
          ${sql.json(requestBase.metadata)}
        )
      `,
      /unique|duplicate/i,
    )
    console.log('OK duplicate pending request rejected')

    const [wrongOrgStudy] = await sql`
      select s.id, s.organization_id
      from public.studies s
      where s.organization_id <> ${org.id}
      limit 1
    `
    if (wrongOrgStudy) {
      await expectDbError(
        'cross-org study scope',
        () => sql`
          insert into public.operational_signature_requests (
            organization_id, study_id, artifact_type, artifact_id,
            required_role, signature_meaning, status
          ) values (
            ${org.id},
            ${wrongOrgStudy.id},
            'operational_signature_test_fixture',
            ${artifactId},
            'pi_sub_i',
            'reviewed_by',
            'pending'
          )
        `,
        /scope|organization|study/i,
      )
      console.log('OK cross-org study scope rejected')
    } else {
      console.log('SKIP cross-org study (single-org staging)')
    }

    const users = await sql`select id from auth.users limit 1`
    const signerUserId = users[0]?.id ?? null
    assert(signerUserId, 'Need at least one auth.users row for append-only signature test')

    const [sig] = await sql`
      insert into public.operational_signatures (
        organization_id, study_id, request_id, artifact_type, artifact_id,
        signer_user_id, signer_role, required_role, signature_meaning,
        signed_artifact_hash, signed_at, ip_address, user_agent, metadata
      ) values (
        ${org.id},
        ${study.id},
        ${req1.id},
        'operational_signature_test_fixture',
        ${artifactId},
        ${signerUserId},
        'pi_sub_i',
        'pi_sub_i',
        'reviewed_by',
        ${'a'.repeat(64)},
        now(),
        '127.0.0.1',
        'staging-live-boundary-test',
        ${sql.json({ live_boundary_test: true })}
      )
      returning id
    `

    await expectDbError(
      'append-only operational_signatures',
      () => sql`
        update public.operational_signatures
        set signature_meaning = 'approved_by'
        where id = ${sig.id}
      `,
      /append-only|deny|mutation/i,
    )
    console.log('OK completed signature update blocked')

    const [evt] = await sql`
      insert into public.operational_signature_events (
        organization_id, study_id, request_id, signature_id,
        event_type, event_payload, actor_user_id
      ) values (
        ${org.id},
        ${study.id},
        ${req1.id},
        ${sig.id},
        'signature_recorded',
        ${sql.json({ live_boundary_test: true })},
        ${signerUserId}
      )
      returning id
    `

    await expectDbError(
      'append-only operational_signature_events',
      () => sql`delete from public.operational_signature_events where id = ${evt.id}`,
      /append-only|deny|mutation/i,
    )
    console.log('OK signature event delete blocked')

    await sql`
      update public.operational_signature_requests
      set status = 'cancelled'
      where id = ${req1.id}
    `

    console.log('\nLIVE eSignature boundaries: PASS')
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((err) => {
  console.error('LIVE eSignature boundaries: FAIL')
  console.error(err.message || err)
  process.exit(1)
})
