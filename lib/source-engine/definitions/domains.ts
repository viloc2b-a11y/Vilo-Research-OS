/**
 * Clinical domains — study-agnostic CRF/eCRF taxonomy.
 * Used to group fields, sections, and VPI signal routing.
 */

export const CLINICAL_DOMAINS = [
  'demographics',
  'informed_consent',
  'medical_history',
  'concomitant_medications',
  'vital_signs',
  'physical_exam',
  'pregnancy_testing',
  'labs',
  'urinalysis',
  'ecg',
  'adverse_events',
  'serious_adverse_events',
  'rescue_medication',
  'questionnaires',
  'respiratory_samples',
  'biospecimens',
  'investigational_product',
  'injection_site',
  'ophthalmology',
  'adrenal_testing',
  'hit_monitoring',
  'pk_sampling',
  'ediary',
  'disposition',
] as const

export type ClinicalDomain = (typeof CLINICAL_DOMAINS)[number]

export function isClinicalDomain(value: string): value is ClinicalDomain {
  return (CLINICAL_DOMAINS as readonly string[]).includes(value)
}

/** Default dot-path prefix per domain for Supabase / eSource persistence. */
export const DOMAIN_SOURCE_PREFIX: Record<ClinicalDomain, string> = {
  demographics: 'demo',
  informed_consent: 'consent',
  medical_history: 'mh',
  concomitant_medications: 'conmed',
  vital_signs: 'vitals',
  physical_exam: 'pe',
  pregnancy_testing: 'pregnancy',
  labs: 'labs',
  urinalysis: 'ua',
  ecg: 'ecg',
  adverse_events: 'ae',
  serious_adverse_events: 'sae',
  rescue_medication: 'rescue',
  questionnaires: 'q',
  respiratory_samples: 'resp',
  biospecimens: 'bio',
  investigational_product: 'ip',
  injection_site: 'inj',
  ophthalmology: 'ophth',
  adrenal_testing: 'adrenal',
  hit_monitoring: 'hit',
  pk_sampling: 'pk',
  ediary: 'ediary',
  disposition: 'disp',
}

export function defaultSourcePath(domain: ClinicalDomain, fieldKey: string): string {
  return `${DOMAIN_SOURCE_PREFIX[domain]}.${fieldKey}`
}
