import type { SupabaseClient } from '@supabase/supabase-js'
import { PUBLICATION_STATUS } from '@/lib/runtime-source-publication/runtime-source-publication-types'

export class PublicationNotFoundError extends Error {
  constructor() {
    super('Published source package not found.')
  }
}

export class PublicationNotPublishedError extends Error {
  constructor(status: string) {
    super(`Source publication is not published (current: ${status}).`)
  }
}

export type LoadedPublishedSourcePackage = {
  publication: {
    id: string
    organizationId: string
    studyId: string
    sourcePackageId: string
    publicationVersion: number
    publicationStatus: string
    packageHash: string
  }
  sourcePackage: {
    id: string
    packageStatus: string
  }
}

export async function loadPublishedSourcePackage(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    studyId: string
    sourcePublicationId: string
  },
): Promise<LoadedPublishedSourcePackage> {
  const { data, error } = await supabase
    .from('runtime_source_package_publications')
    .select(
      'id, organization_id, study_id, source_package_id, publication_version, publication_status, package_hash',
    )
    .eq('id', args.sourcePublicationId)
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new PublicationNotFoundError()

  const publicationStatus = String(data.publication_status)
  if (publicationStatus !== PUBLICATION_STATUS.PUBLISHED) {
    throw new PublicationNotPublishedError(publicationStatus)
  }

  const sourcePackageId = String(data.source_package_id)

  const { data: pkg, error: pkgError } = await supabase
    .from('runtime_source_packages')
    .select('id, package_status')
    .eq('id', sourcePackageId)
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .maybeSingle()

  if (pkgError) throw new Error(pkgError.message)
  if (!pkg) throw new Error('Source package not found for publication.')

  return {
    publication: {
      id: String(data.id),
      organizationId: String(data.organization_id),
      studyId: String(data.study_id),
      sourcePackageId,
      publicationVersion: Number(data.publication_version),
      publicationStatus,
      packageHash: String(data.package_hash),
    },
    sourcePackage: {
      id: String(pkg.id),
      packageStatus: String(pkg.package_status),
    },
  }
}

