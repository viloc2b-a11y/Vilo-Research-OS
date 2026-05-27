import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPublishedSourcePackage } from './load-published-source-package'

export type PublishedSourceVisitShell = {
  id: string
  visitCode: string
  visitName: string
  runtimeVisitId: string
  sequenceOrder: number
}

export type PublishedSourceVersionWithShells = {
  publication_id: string
  source_package_id: string
  publication_version: number
  package_hash: string
  visit_shells: PublishedSourceVisitShell[]
}

export async function listPublishedSourceVisitShells(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    studyId: string
    sourcePublicationId: string
  },
): Promise<PublishedSourceVersionWithShells> {
  const loaded = await loadPublishedSourcePackage(supabase, args)

  const { data: shells, error } = await supabase
    .from('runtime_source_visit_shells')
    .select('id, visit_code, visit_name, runtime_visit_id, sequence_order')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('source_package_id', loaded.publication.sourcePackageId)
    .order('sequence_order', { ascending: true })

  if (error) throw new Error(error.message)

  return {
    publication_id: loaded.publication.id,
    source_package_id: loaded.publication.sourcePackageId,
    publication_version: loaded.publication.publicationVersion,
    package_hash: loaded.publication.packageHash,
    visit_shells: (shells ?? []).map((s) => ({
      id: String(s.id),
      visitCode: String(s.visit_code),
      visitName: String(s.visit_name),
      runtimeVisitId: String(s.runtime_visit_id),
      sequenceOrder: Number(s.sequence_order ?? 0),
    })),
  }
}

