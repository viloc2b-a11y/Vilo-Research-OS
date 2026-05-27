import type { SupabaseClient } from '@supabase/supabase-js'
import { mapPublicationEventRow, mapPublicationRow } from './runtime-source-publication-types'

export async function loadRuntimeSourcePublication(args: {
  supabase: SupabaseClient
  organizationId: string
  publicationId: string
}): Promise<{ publication: ReturnType<typeof mapPublicationRow>; events: ReturnType<typeof mapPublicationEventRow>[] } | null> {
  const { data: pubRow, error: pubError } = await args.supabase
    .from('runtime_source_package_publications')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('id', args.publicationId)
    .maybeSingle()

  if (pubError) throw new Error(pubError.message)
  if (!pubRow) return null

  const publication = mapPublicationRow(pubRow as Record<string, unknown>)

  const { data: eventRows, error: eventError } = await args.supabase
    .from('runtime_source_publication_events')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('publication_id', publication.id)
    .order('event_timestamp', { ascending: false })
    .limit(200)

  if (eventError) throw new Error(eventError.message)

  return {
    publication,
    events: (eventRows ?? []).map((row) => mapPublicationEventRow(row as Record<string, unknown>)),
  }
}

