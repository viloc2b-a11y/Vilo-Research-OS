import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRuntimeSourcePackage } from '@/lib/runtime-source-package/load-runtime-source-package'
import { PACKAGE_STATUS } from '@/lib/runtime-source-package/source-package-types'
import { appendPublicationEvent } from './append-publication-event'
import { createSignaturePlaceholdersFromPackage } from './create-signature-placeholders-from-package'
import {
  PUBLICATION_EVENT_TYPE,
  PUBLICATION_STATUS,
  mapPublicationRow,
  type RuntimeSourcePackagePublicationRow,
} from './runtime-source-publication-types'

export class PackageNotApprovedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageNotApprovedError'
  }
}

async function nextPublicationVersion(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<number> {
  const { data, error } = await args.supabase
    .from('runtime_source_package_publications')
    .select('publication_version')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .order('publication_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? Number(data.publication_version) + 1 : 1
}

export async function publishRuntimeSourcePackage(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  sourcePackageId: string
  actorId: string
}): Promise<RuntimeSourcePackagePublicationRow> {
  // Idempotent: if this package already has a publication, return it.
  const { data: existingPub, error: existingError } = await args.supabase
    .from('runtime_source_package_publications')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('source_package_id', args.sourcePackageId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existingPub) return mapPublicationRow(existingPub as Record<string, unknown>)

  const loaded = await loadRuntimeSourcePackage(args.supabase, args.organizationId, args.sourcePackageId)
  if (!loaded) throw new Error('Source package not found')
  if (loaded.package.studyId !== args.studyId) throw new Error('study_id does not match source package')

  if (loaded.package.packageStatus !== PACKAGE_STATUS.APPROVED) {
    throw new PackageNotApprovedError('Source package must be approved before publish.')
  }

  // Ensure default signature placeholders exist (idempotent).
  await createSignaturePlaceholdersFromPackage({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    sourcePackageId: args.sourcePackageId,
    actorId: args.actorId,
  })

  // Supersede prior active publication for the study (best-effort).
  const { data: priorActive, error: priorError } = await args.supabase
    .from('runtime_source_package_publications')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('publication_status', PUBLICATION_STATUS.PUBLISHED)
    .order('publication_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (priorError) throw new Error(priorError.message)

  const publicationVersion = await nextPublicationVersion({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
  })

  const { data: inserted, error: insertError } = await args.supabase
    .from('runtime_source_package_publications')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      source_package_id: args.sourcePackageId,
      publication_version: publicationVersion,
      publication_status: PUBLICATION_STATUS.PUBLISHED,
      package_hash: loaded.package.packageHash,
      published_by: args.actorId,
      published_at: new Date().toISOString(),
      supersedes_publication_id: priorActive?.id ?? null,
      metadata: {},
    })
    .select('*')
    .single()

  if (insertError || !inserted) {
    await appendPublicationEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      sourcePackageId: args.sourcePackageId,
      publicationId: null,
      eventType: PUBLICATION_EVENT_TYPE.SOURCE_PACKAGE_PUBLISH_FAILED,
      actorId: args.actorId,
      eventPayload: { error: insertError?.message ?? 'Unknown error' },
      stateSnapshot: { status: 'failed' },
    })
    throw new Error(insertError?.message ?? 'Failed to publish source package')
  }

  const publication = mapPublicationRow(inserted as Record<string, unknown>)

  await appendPublicationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    sourcePackageId: args.sourcePackageId,
    publicationId: publication.id,
    eventType: PUBLICATION_EVENT_TYPE.SOURCE_PACKAGE_PUBLISHED,
    actorId: args.actorId,
    eventPayload: {
      publication_version: publication.publicationVersion,
      package_hash: publication.packageHash,
      supersedes_publication_id: publication.supersedesPublicationId,
    },
    stateSnapshot: {
      publication_id: publication.id,
      status: publication.publicationStatus,
      version: publication.publicationVersion,
      package_hash: publication.packageHash,
    },
  })

  if (priorActive?.id) {
    const { error: supersedeError } = await args.supabase
      .from('runtime_source_package_publications')
      .update({ publication_status: PUBLICATION_STATUS.SUPERSEDED })
      .eq('id', String(priorActive.id))
      .eq('organization_id', args.organizationId)

    if (supersedeError) throw new Error(supersedeError.message)

    await appendPublicationEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      sourcePackageId: String(priorActive.source_package_id),
      publicationId: String(priorActive.id),
      eventType: PUBLICATION_EVENT_TYPE.SOURCE_PACKAGE_SUPERSEDED,
      actorId: args.actorId,
      eventPayload: { superseded_by_publication_id: publication.id },
      stateSnapshot: { publication_id: String(priorActive.id), status: PUBLICATION_STATUS.SUPERSEDED },
    })
  }

  return publication
}

