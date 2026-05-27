/**
 * Phase P4B smoke: published source gating for visit runtime execution.
 *
 * Usage:
 *   npx tsx scripts/visit-runtime-published-source-phaseP4B-smoke.ts
 *   npx tsx scripts/visit-runtime-published-source-phaseP4B-smoke.ts --live
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createVisitInstanceFromShell } from '../lib/visit-runtime-execution/create-visit-instance-from-shell'
import { lockVisitRuntimeInstance } from '../lib/visit-runtime-locking/lock-visit-runtime-instance'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function loadPublicationFingerprint(
  supabase: SupabaseClient,
  publicationId: string,
): Promise<string> {
  const { data } = await supabase
    .from('runtime_source_package_publications')
    .select('*')
    .eq('id', publicationId)
    .maybeSingle()
  return JSON.stringify(data ?? null)
}

async function loadPackageFingerprint(supabase: SupabaseClient, packageId: string): Promise<string> {
  const { data } = await supabase
    .from('runtime_source_packages')
    .select('id, package_status, package_hash, package_json')
    .eq('id', packageId)
    .maybeSingle()
  return JSON.stringify(data ?? null)
}

async function runUnitChecks() {
  console.log('--- Phase P4B unit checks ---')

  let rejected = false
  try {
    await createVisitInstanceFromShell({
      // @ts-expect-error unit check uses stub
      supabase: null,
      createdBy: 'user-1',
      input: {
        organization_id: 'org-1',
        study_id: 'study-1',
        subject_id: 'sub-1',
        visit_shell_id: 'shell-1',
      },
    })
  } catch (error) {
    rejected = error instanceof Error && error.message.includes('published source package')
  }
  assert(rejected, 'requires publication by default')

  console.log('✅ Published-source gate enforced by default')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.VISIT_RUNTIME_SMOKE_ORG_ID ?? process.env.RUNTIME_SOURCE_SMOKE_ORG_ID
  const studyId = process.env.VISIT_RUNTIME_SMOKE_STUDY_ID ?? process.env.RUNTIME_SOURCE_SMOKE_STUDY_ID
  const subjectId = process.env.VISIT_RUNTIME_SMOKE_SUBJECT_ID
  const actorId =
    process.env.VISIT_RUNTIME_SMOKE_ACTOR_ID
    ?? process.env.RUNTIME_SOURCE_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId || !subjectId) {
    console.log(
      '⏭️  Set VISIT_RUNTIME_SMOKE_ORG_ID, VISIT_RUNTIME_SMOKE_STUDY_ID, VISIT_RUNTIME_SMOKE_SUBJECT_ID',
    )
    return
  }

  console.log('--- Phase P4B live integration ---')
  const supabase = createClient(url, key)

  const { data: pub } = await supabase
    .from('runtime_source_package_publications')
    .select('id, source_package_id, publication_version, package_hash')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .eq('publication_status', 'published')
    .order('publication_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!pub) {
    console.log('⏭️  No published source version — publish a source package in P4A first')
    return
  }

  const publicationId = String(pub.id)
  const sourcePackageId = String(pub.source_package_id)
  const publicationVersion = Number(pub.publication_version)
  const packageHash = String(pub.package_hash)

  const publicationBefore = await loadPublicationFingerprint(supabase, publicationId)
  const packageBefore = await loadPackageFingerprint(supabase, sourcePackageId)

  const { data: visitShell } = await supabase
    .from('runtime_source_visit_shells')
    .select('id')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .eq('source_package_id', sourcePackageId)
    .order('sequence_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!visitShell) {
    console.log('⏭️  No visit shells on published source package')
    return
  }

  const created = await createVisitInstanceFromShell({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      subject_id: subjectId,
      source_publication_id: publicationId,
      visit_shell_id: String(visitShell.id),
    },
  })

  assert(created.visitInstance.sourcePublicationId === publicationId, 'source_publication_id stored')
  assert(
    created.visitInstance.sourcePublicationVersion === publicationVersion,
    'source_publication_version stored',
  )
  assert(created.visitInstance.sourcePackageHash === packageHash, 'source_package_hash stored')
  console.log('✅ Visit instance stores publication id/version/hash')

  // Shell must belong to published package
  const { data: foreignShell } = await supabase
    .from('runtime_source_visit_shells')
    .select('id')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .neq('source_package_id', sourcePackageId)
    .limit(1)
    .maybeSingle()

  if (foreignShell) {
    let mismatchRejected = false
    try {
      await createVisitInstanceFromShell({
        supabase,
        createdBy: actorId,
        input: {
          organization_id: orgId,
          study_id: studyId,
          subject_id: subjectId,
          source_publication_id: publicationId,
          visit_shell_id: String(foreignShell.id),
        },
      })
    } catch (error) {
      mismatchRejected = error instanceof Error && error.message.includes('Visit shell not found')
    }
    assert(mismatchRejected, 'rejects visit shell not in published package')
    console.log('✅ Visit shell must belong to published source package')
  } else {
    console.log('⏭️  No foreign visit shell to test mismatch rejection')
  }

  // Legacy rejection in production-like mode
  let legacyRejected = false
  try {
    await createVisitInstanceFromShell({
      supabase,
      createdBy: actorId,
      input: {
        organization_id: orgId,
        study_id: studyId,
        subject_id: subjectId,
        source_package_id: sourcePackageId,
        visit_shell_id: String(visitShell.id),
      },
      allowUnpublishedSource: false,
    })
  } catch (error) {
    legacyRejected = error instanceof Error && error.message.includes('published source package')
  }
  assert(legacyRejected, 'legacy draft flow rejected in production-like mode')
  console.log('✅ Legacy flow rejected without explicit allow flag')

  // Snapshot preserves publication context
  const locked = await lockVisitRuntimeInstance({
    supabase,
    organizationId: orgId,
    visitInstanceId: created.visitInstance.id,
    lockedBy: actorId,
    lockReason: 'P4B smoke lock',
  })

  assert(
    locked.snapshot.snapshotJson.source_context.source_publication_id === publicationId,
    'snapshot source_context.source_publication_id',
  )
  assert(
    locked.snapshot.snapshotJson.source_context.source_publication_version === publicationVersion,
    'snapshot source_context.source_publication_version',
  )
  assert(
    locked.snapshot.snapshotJson.source_context.source_package_hash === packageHash,
    'snapshot source_context.source_package_hash',
  )
  console.log('✅ Snapshot source_context preserves publication id/version/hash')

  const publicationAfter = await loadPublicationFingerprint(supabase, publicationId)
  const packageAfter = await loadPackageFingerprint(supabase, sourcePackageId)
  assert(publicationBefore === publicationAfter, 'publication unchanged')
  assert(packageBefore === packageAfter, 'source package unchanged')
  console.log('✅ Publication/source package remain unchanged')
}

async function main() {
  await runUnitChecks()
  if (LIVE) await runLiveChecks()
  else console.log('Tip: run with --live and VISIT_RUNTIME_SMOKE_* env vars for DB integration')
  console.log('------------------------------------------------------------')
  console.log('Phase P4B published-source visit runtime smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})

