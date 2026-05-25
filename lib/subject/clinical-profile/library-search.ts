'use server'
// lib/subject/clinical-profile/library-search.ts
// Server actions for searching Phase 6B.1 pathology and medication libraries.
// Uses PostgreSQL trigram similarity (pg_trgm) via ilike + limit.
// Called from client components via useTransition — returns serializable arrays.

import { createServerClient } from '@/lib/supabase/server'
import { filterAllergenVocabularyFallback } from '@/lib/subject/clinical-profile/allergy-vocabulary-fallback'
import type { SubjectClinicalProfileEvent } from './types'
import type {
  AllergenResult,
  MedicationLibrarySearchOutcome,
  MedicationResult,
  PathologyResult,
} from './library-search-types'

// ---------------------------------------------------------------------------
// Pathology library search
// ---------------------------------------------------------------------------

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

function escapeMedicationIlike(value: string) {
  return value.replace(/[%_,]/g, ' ').trim()
}

function mapMedicationLibraryRow(row: Record<string, unknown>): MedicationResult | null {
  const medication_id =
    row.medication_id != null ? String(row.medication_id).trim() : ''
  const medication_name =
    row.medication_name != null ? String(row.medication_name).trim() : ''
  if (!medication_id || !medication_name) return null

  return {
    medication_id,
    medication_name,
    brand_name:
      row.brand_name != null && String(row.brand_name).trim()
        ? String(row.brand_name).trim()
        : null,
    drug_class:
      row.drug_class != null && String(row.drug_class).trim()
        ? String(row.drug_class).trim()
        : null,
    route:
      row.route != null && String(row.route).trim() ? String(row.route).trim() : null,
  }
}

export async function searchMedicationLibrary(
  query: string,
): Promise<MedicationLibrarySearchOutcome> {
  try {
    const raw = typeof query === 'string' ? query : String(query ?? '')
    const q = escapeMedicationIlike(raw)
    if (q.length < 2) return { results: [] }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.error('[searchMedicationLibrary] no authenticated session')
      return {
        results: [],
        error: 'Sign in required to search the medication library.',
      }
    }

    const pattern = `%${q}%`
    const { data, error } = await supabase
      .from('medication_library')
      .select('medication_id, medication_name, brand_name, drug_class, route')
      .eq('active_flag', true)
      .or(
        `medication_name.ilike.${pattern},brand_name.ilike.${pattern},drug_class.ilike.${pattern}`,
      )
      .order('medication_name')
      .limit(15)

    if (error) {
      console.error('[searchMedicationLibrary] supabase query failed', {
        code: error.code,
        message: error.message,
        query: q,
      })
      return {
        results: [],
        error: 'Medication library search is temporarily unavailable.',
      }
    }

    const results: MedicationResult[] = []
    for (const row of data ?? []) {
      const mapped = mapMedicationLibraryRow(row as Record<string, unknown>)
      if (mapped) results.push(mapped)
    }
    return { results }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[searchMedicationLibrary] unexpected failure', message, err)
    return {
      results: [],
      error: 'Medication library search failed.',
    }
  }
}

// ---------------------------------------------------------------------------
// Allergen vocabulary search (library when available + safe fallback)
// ---------------------------------------------------------------------------

export async function searchAllergenLibrary(query: string): Promise<AllergenResult[]> {
  if (!query || query.trim().length < 2) return []

  const q = query.trim()
  const seen = new Set<string>()
  const merged: AllergenResult[] = []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('allergy_library')
    .select('allergy_id, display_name, allergen_type, category')
    .or(`display_name.ilike.%${q}%,category.ilike.%${q}%`)
    .eq('active_flag', true)
    .order('display_name')
    .limit(15)

  if (!error && data?.length) {
    for (const row of data) {
      const label = String(row.display_name ?? '').trim()
      if (!label) continue
      const key = label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({
        vocabulary_id: String(row.allergy_id),
        display_name: label,
        allergen_type: (row.allergen_type as AllergenResult['allergen_type']) ?? null,
        category: (row.category as string | null) ?? null,
      })
    }
  }

  // TODO: Remove fallback once canonical allergy_library is seeded in all environments.
  for (const entry of filterAllergenVocabularyFallback(q)) {
    const key = entry.display_name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }

  return merged.slice(0, 15)
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
