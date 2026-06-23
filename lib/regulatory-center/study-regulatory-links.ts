import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegulatoryPersonnelEntry } from './regulatory-personnel'
import type { RegulatoryDocumentWithOwner } from './regulatory-master-documents'
import { getExpirationBucket, type ExpirationBucket } from './regulatory-expiration'

// ── Types ────────────────────────────────────────────────────────────────────

export type StudyLinkType = 'personnel' | 'document'

export type StudyRegulatoryLinkEntry = {
  id: string
  organization_id: string
  study_id: string
  link_type: string
  personnel_id: string | null
  master_document_id: string | null
  required: boolean
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type StudyLinkWithDetails = StudyRegulatoryLinkEntry & {
  /** Populated when link_type = 'personnel' */
  personnel_name?: string
  personnel_role?: string
  personnel_status?: string
  /** Populated when link_type = 'document' */
  document_title?: string
  document_type?: string
  document_status?: string
  expiration_date?: string | null
  expiration_bucket?: ExpirationBucket
  owner_name?: string | null
}

export type StudyInfo = {
  id: string
  name: string
  status: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

export const LINK_STATUSES = ['active', 'inactive', 'needs_review'] as const

// ── Loaders ──────────────────────────────────────────────────────────────────

export async function loadStudyLinks(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<StudyLinkWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('study_regulatory_links')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading study links:', error.message)
      return []
    }

    return (data ?? []) as StudyLinkWithDetails[]
  } catch (err) {
    console.error('Error loading study links:', err)
    return []
  }
}

/**
 * Load study links enriched with personnel/document details.
 */
export async function loadStudyLinksWithDetails(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  personnel: RegulatoryPersonnelEntry[],
  documents: RegulatoryDocumentWithOwner[],
): Promise<StudyLinkWithDetails[]> {
  const links = await loadStudyLinks(supabase, organizationId, studyId)

  const personnelMap = new Map(personnel.map((p) => [p.id, p]))
  const docsMap = new Map(documents.map((d) => [d.id, d]))

  return links.map((link) => {
    const enriched: StudyLinkWithDetails = { ...link }

    if (link.link_type === 'personnel' && link.personnel_id) {
      const p = personnelMap.get(link.personnel_id)
      if (p) {
        enriched.personnel_name = p.full_name
        enriched.personnel_role = p.role
        enriched.personnel_status = p.status
      }
    }

    if (link.link_type === 'document' && link.master_document_id) {
      const d = docsMap.get(link.master_document_id)
      if (d) {
        enriched.document_title = d.document_title
        enriched.document_type = d.document_type
        enriched.document_status = d.status
        enriched.expiration_date = d.expiration_date ?? null
        enriched.expiration_bucket = getExpirationBucket(d)
        enriched.owner_name = d.owner_name ?? null
      }
    }

    return enriched
  })
}

/**
 * Load all studies in an organization for the study selector.
 */
export async function loadOrgStudies(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StudyInfo[]> {
  try {
    const { data, error } = await supabase
      .from('studies')
      .select('id, name, status')
      .eq('organization_id', organizationId)
      .neq('status', 'archived')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error loading studies:', error.message)
      return []
    }

    return (data ?? []) as StudyInfo[]
  } catch (err) {
    console.error('Error loading studies:', err)
    return []
  }
}
