import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export const REGULATORY_ROLES = [
  'PI',
  'Sub-I',
  'Coordinator',
  'Regulatory Specialist',
  'Pharmacist',
  'Lab Director',
  'Other',
] as const

export type RegulatoryRole = (typeof REGULATORY_ROLES)[number]

export const PERSONNEL_STATUSES = ['active', 'inactive', 'needs_review'] as const

export type PersonnelStatus = (typeof PERSONNEL_STATUSES)[number]

export type RegulatoryPersonnelEntry = {
  id: string
  organization_id: string
  full_name: string
  role: string
  email: string | null
  phone: string | null
  npi: string | null
  license_number: string | null
  dea_number: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type CreatePersonnelInput = {
  fullName: string
  role: RegulatoryRole
  email?: string | null
  phone?: string | null
  npi?: string | null
  licenseNumber?: string | null
  deaNumber?: string | null
  notes?: string | null
}

export type UpdatePersonnelInput = {
  id: string
  fullName?: string
  role?: RegulatoryRole
  email?: string | null
  phone?: string | null
  npi?: string | null
  licenseNumber?: string | null
  deaNumber?: string | null
  status?: PersonnelStatus
  notes?: string | null
}

export type PersonnelActionResult = {
  ok: boolean
  error?: string
  data?: RegulatoryPersonnelEntry
}

// ── Loader ───────────────────────────────────────────────────────────────────

export async function loadRegulatoryPersonnel(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { role?: string; search?: string; status?: string },
): Promise<RegulatoryPersonnelEntry[]> {
  try {
    let query = supabase
      .from('regulatory_personnel')
      .select('*')
      .eq('organization_id', organizationId)
      .order('full_name', { ascending: true })

    if (options?.role) {
      query = query.eq('role', options.role)
    }
    if (options?.status) {
      query = query.eq('status', options.status)
    }
    if (options?.search) {
      query = query.or(
        `full_name.ilike.%${options.search}%,email.ilike.%${options.search}%`,
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading regulatory personnel:', error.message)
      return []
    }

    return (data ?? []) as RegulatoryPersonnelEntry[]
  } catch (err) {
    console.error('Error loading regulatory personnel:', err)
    return []
  }
}

export async function loadPersonnelById(
  supabase: SupabaseClient,
  id: string,
): Promise<RegulatoryPersonnelEntry | null> {
  try {
    const { data, error } = await supabase
      .from('regulatory_personnel')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return data as RegulatoryPersonnelEntry
  } catch {
    return null
  }
}
