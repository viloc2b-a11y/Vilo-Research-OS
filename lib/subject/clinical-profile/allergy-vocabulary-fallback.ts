/**
 * Coordinator-friendly allergen suggestions until canonical allergy_library ships.
 * TODO: Replace with Supabase allergy_library search (Phase 6B.x) when available.
 */

import type { AllergenType } from '@/lib/subject/clinical-profile/types'

export type AllergenVocabularyEntry = {
  /** Stable id for list keys; not persisted. */
  vocabulary_id: string
  display_name: string
  allergen_type: AllergenType | null
  category: string | null
}

export const ALLERGEN_VOCABULARY_FALLBACK: AllergenVocabularyEntry[] = [
  { vocabulary_id: 'fb-penicillin', display_name: 'Penicillin', allergen_type: 'drug', category: 'Antibiotic' },
  { vocabulary_id: 'fb-amoxicillin', display_name: 'Amoxicillin', allergen_type: 'drug', category: 'Antibiotic' },
  { vocabulary_id: 'fb-sulfa', display_name: 'Sulfonamides', allergen_type: 'drug', category: 'Antibiotic class' },
  { vocabulary_id: 'fb-aspirin', display_name: 'Aspirin', allergen_type: 'drug', category: 'NSAID' },
  { vocabulary_id: 'fb-ibuprofen', display_name: 'Ibuprofen', allergen_type: 'drug', category: 'NSAID' },
  { vocabulary_id: 'fb-codeine', display_name: 'Codeine', allergen_type: 'drug', category: 'Opioid' },
  { vocabulary_id: 'fb-morphine', display_name: 'Morphine', allergen_type: 'drug', category: 'Opioid' },
  { vocabulary_id: 'fb-latex', display_name: 'Latex', allergen_type: 'latex', category: 'Contact' },
  { vocabulary_id: 'fb-peanuts', display_name: 'Peanuts', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-tree-nuts', display_name: 'Tree nuts', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-shellfish', display_name: 'Shellfish', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-eggs', display_name: 'Eggs', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-milk', display_name: 'Milk', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-soy', display_name: 'Soy', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-wheat', display_name: 'Wheat', allergen_type: 'food', category: 'Food' },
  { vocabulary_id: 'fb-pollen', display_name: 'Pollen', allergen_type: 'environmental', category: 'Seasonal' },
  { vocabulary_id: 'fb-dust', display_name: 'Dust mites', allergen_type: 'environmental', category: 'Indoor' },
  { vocabulary_id: 'fb-cat', display_name: 'Cat dander', allergen_type: 'environmental', category: 'Animal' },
  { vocabulary_id: 'fb-iodine', display_name: 'Iodine', allergen_type: 'contrast', category: 'Contrast media' },
  { vocabulary_id: 'fb-bee', display_name: 'Bee sting', allergen_type: 'environmental', category: 'Venom' },
]

export function filterAllergenVocabularyFallback(query: string, limit = 15): AllergenVocabularyEntry[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  return ALLERGEN_VOCABULARY_FALLBACK.filter((entry) => {
    const name = entry.display_name.toLowerCase()
    const category = entry.category?.toLowerCase() ?? ''
    return name.includes(q) || category.includes(q)
  }).slice(0, limit)
}
