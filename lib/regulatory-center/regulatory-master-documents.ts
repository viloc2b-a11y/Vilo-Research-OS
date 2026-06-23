import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegulatoryPersonnelEntry } from './regulatory-personnel'

// ── Types ────────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'CV', 'Medical License', 'DEA', 'GCP', 'IATA', 'HSP',
  'Financial Disclosure', 'CLIA', 'CAP', 'Insurance', 'W9',
  'Business License', 'SOP', 'Lab Certification', 'Other',
] as const

export type RegulatoryDocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_STATUSES = ['active', 'inactive', 'needs_review', 'expired'] as const

export type RegulatoryDocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const OWNER_TYPES = ['person', 'organization', 'facility'] as const

export type OwnerType = (typeof OWNER_TYPES)[number]

export type RegulatoryDocumentEntry = {
  id: string
  organization_id: string
  owner_type: string
  owner_personnel_id: string | null
  document_type: string
  document_title: string
  document_reference: string | null
  document_center_id: string | null
  version: string | null
  effective_date: string | null
  expiration_date: string | null
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RegulatoryDocumentWithOwner = RegulatoryDocumentEntry & {
  owner_name: string | null
  dc_document_name?: string | null
  dc_document_classification?: string | null
  dc_filename?: string | null
}

// ── Document Center Record (lightweight, for the selector) ───────────────

export type DocumentCenterRecord = {
  id: string
  operational_display_name: string
  document_classification: string
  original_filename: string
  mime_type: string
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getExpirationLabel(expirationDate: string | null): string | null {
  if (!expirationDate) return null
  const now = new Date()
  const exp = new Date(expirationDate)
  const daysUntilExpiry = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'expiring_soon'
  if (daysUntilExpiry <= 60) return 'expiring_soon'
  if (daysUntilExpiry <= 90) return 'expiring_soon'
  return null
}

// ── Document Center loader ────────────────────────────────────────────────────

/**
 * Load Document Center records for an organization.
 * Used by the Regulatory Center to select existing documents.
 */
export async function loadDocumentCenterRecords(
  supabase: SupabaseClient,
  organizationId: string,
  search?: string,
): Promise<DocumentCenterRecord[]> {
  try {
    let query = supabase
      .from('compliance_runtime_documents')
      .select('id, operational_display_name, document_classification, original_filename, mime_type, created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    if (search) {
      const q = `%${search}%`
      query = query.or(
        `operational_display_name.ilike.${q},original_filename.ilike.${q},document_classification.ilike.${q}`,
      )
    }

    const { data, error } = await query
    if (error) {
      console.error('Error loading Document Center records:', error.message)
      return []
    }

    return (data ?? []) as DocumentCenterRecord[]
  } catch (err) {
    console.error('Error loading Document Center records:', err)
    return []
  }
}

// ── Loader ───────────────────────────────────────────────────────────────────

export async function loadRegulatoryDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    documentType?: string
    ownerType?: string
    status?: string
    search?: string
    personnel?: RegulatoryPersonnelEntry[]
  },
): Promise<RegulatoryDocumentWithOwner[]> {
  try {
    let query = supabase
      .from('regulatory_master_documents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (options?.documentType) {
      query = query.eq('document_type', options.documentType)
    }
    if (options?.ownerType) {
      query = query.eq('owner_type', options.ownerType)
    }
    if (options?.status) {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading regulatory documents:', error.message)
      return []
    }

    const rows = (data ?? []) as RegulatoryDocumentEntry[]

    // Build owner name map from personnel data
    const personnelMap = new Map<string, string>()
    if (options?.personnel) {
      for (const p of options.personnel) {
        personnelMap.set(p.id, p.full_name)
      }
    }

    // Search filter (client-side since it involves owner name)
    let result: RegulatoryDocumentWithOwner[] = rows.map((r) => ({
      ...r,
      owner_name: r.owner_personnel_id ? (personnelMap.get(r.owner_personnel_id) ?? null) : r.owner_type,
    }))

    // If DC records were loaded, attach document center info
    if (options?.personnel) {
      // Check if there are document_center_ids to resolve
      const dcIds = rows.map((r) => r.document_center_id).filter(Boolean) as string[]
      if (dcIds.length > 0) {
        const { data: dcDocs } = await supabase
          .from('compliance_runtime_documents')
          .select('id, operational_display_name, document_classification, original_filename')
          .in('id', dcIds)

        if (dcDocs) {
          const dcMap = new Map(dcDocs.map((d: Record<string, unknown>) => [d.id, d]))
          result = result.map((r) => {
            if (!r.document_center_id) return r
            const dc = dcMap.get(r.document_center_id)
            if (!dc) return r
            return {
              ...r,
              dc_document_name: String(dc.operational_display_name ?? '') || String(dc.original_filename ?? ''),
              dc_document_classification: String(dc.document_classification ?? ''),
              dc_filename: String(dc.original_filename ?? ''),
            }
          })
        }
      }
    }

    if (options?.search) {
      const q = options.search.toLowerCase()
      result = result.filter(
        (r) =>
          r.document_title.toLowerCase().includes(q) ||
          r.document_type.toLowerCase().includes(q) ||
          (r.owner_name ?? '').toLowerCase().includes(q) ||
          (r.document_reference ?? '').toLowerCase().includes(q) ||
          (r.dc_document_name ?? '').toLowerCase().includes(q),
      )
    }

    return result
  } catch (err) {
    console.error('Error loading regulatory documents:', err)
    return []
  }
}
