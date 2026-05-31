import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import {
  classificationLabel,
  resolveDocumentDestination,
  type StudySetupDestinationKind,
  type StudySetupRouteStatus,
} from './study-setup-document-routing'

export type StudySetupDocument = {
  id: string
  name: string
  originalFilename: string
  classification: string
  classificationLabel: string
  destinationLabel: string
  outputLabel: string
  routeStatus: StudySetupRouteStatus
  destinationKind: StudySetupDestinationKind
  actionLabel: string | null
  status: string
  createdAt: string
}

const MAX_DOCUMENTS = 200

/**
 * Canonical study-scoped document list for the Study Setup surface. Reads
 * `compliance_runtime_documents` filtered by organization_id + study_id. No
 * study-scoped list source existed before this (the only prior reader was the
 * org-wide, 10-row `/api/document-intake/recent`), so this is not a duplicate.
 */
export async function loadStudySetupDocuments(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudySetupDocument[]> {
  const supabase = supabaseClient ?? (await createServerClient())

  try {
    const { data, error } = await supabase
      .from('compliance_runtime_documents')
      .select(
        'id, operational_display_name, original_filename, document_classification, status, created_at',
      )
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .order('created_at', { ascending: false })
      .limit(MAX_DOCUMENTS)

    if (error || !data?.length) return []

    return data.map((row) => {
      const classification = String(row.document_classification ?? '')
      const destination = resolveDocumentDestination(classification)
      return {
        id: String(row.id),
        name: String(row.operational_display_name ?? row.original_filename ?? 'Untitled document'),
        originalFilename: String(row.original_filename ?? ''),
        classification,
        classificationLabel: classificationLabel(classification),
        destinationLabel: destination.destinationLabel,
        outputLabel: destination.outputLabel,
        routeStatus: destination.routeStatus,
        destinationKind: destination.destinationKind,
        actionLabel: destination.actionLabel,
        status: String(row.status ?? 'active'),
        createdAt: String(row.created_at ?? ''),
      }
    })
  } catch {
    return []
  }
}
