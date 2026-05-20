'use server'
// lib/subject/clinical-profile/library-search.ts
// Server actions for searching Phase 6B.1 pathology and medication libraries.
// Uses PostgreSQL trigram similarity (pg_trgm) via ilike + limit.
// Called from client components via useTransition — returns serializable arrays.

import { createServerClient } from '@/lib/supabase/server'
import type { SubjectClinicalProfileEvent } from './types'

// ---------------------------------------------------------------------------
// Pathology library search
// ---------------------------------------------------------------------------

export interface PathologyResult {
  pathology_id: string
  common_name: string
  medical_name: string | null
  icd10_code: string | null
  system: string
}

export async function searchPathologyLibrary(
  query: string,
): Promise<PathologyResult[]> {
  if (!query || query.trim().length < 2) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('pathology_library')
    .select('pathology_id, common_name, medical_name, icd10_code, system')
    .or(
      `common_name.ilike.%${query}%,medical_name.ilike.%${query}%,icd10_code.ilike.%${query}%`,
    )
    .eq('active_flag', true)
    .order('common_name')
    .limit(15)

  if (error) return []
  return (data ?? []) as PathologyResult[]
}

// ---------------------------------------------------------------------------
// Medication library search
// ---------------------------------------------------------------------------

export interface MedicationResult {
  medication_id: string
  medication_name: string
  brand_name: string | null
  drug_class: string | null
  route: string | null
}

export async function searchMedicationLibrary(
  query: string,
): Promise<MedicationResult[]> {
  if (!query || query.trim().length < 2) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('medication_library')
    .select('medication_id, medication_name, brand_name, drug_class, route')
    .or(
      `medication_name.ilike.%${query}%,brand_name.ilike.%${query}%`,
    )
    .eq('active_flag', true)
    .order('medication_name')
    .limit(15)

  if (error) return []
  return (data ?? []) as MedicationResult[]
}

// ---------------------------------------------------------------------------
// Audit trail fetch (called from EntryAuditPanel client component)
// ---------------------------------------------------------------------------

export async function fetchRecordAuditTrail(
  record_id: string,
): Promise<SubjectClinicalProfileEvent[]> {
  if (!record_id) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_clinical_profile_events')
    .select('*')
    .eq('record_id', record_id)
    .order('occurred_at', { ascending: true })

  if (error) return []
  return (data ?? []) as SubjectClinicalProfileEvent[]
}
