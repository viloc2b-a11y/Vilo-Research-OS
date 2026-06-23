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

    if (options?.search) {
      const q = options.search.toLowerCase()
      result = result.filter(
        (r) =>
          r.document_title.toLowerCase().includes(q) ||
          r.document_type.toLowerCase().includes(q) ||
          (r.owner_name ?? '').toLowerCase().includes(q) ||
          (r.document_reference ?? '').toLowerCase().includes(q),
      )
    }

    return result
  } catch (err) {
    console.error('Error loading regulatory documents:', err)
    return []
  }
}
