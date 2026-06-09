import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignaturePolicyCode } from './operational-signature-types'

export type SignaturePolicyRow = {
  policyCode: SignaturePolicyCode | string
  policyName: string
  description: string | null
  allowedRoles: string[]
  mfaRequired: boolean
  coSignatureRequired: boolean
  signatureMeaningRequired: boolean
  subjectInvolvementRequired: boolean
  active: boolean
}

const CRITICAL_MEANINGS = new Set(['lock_approval'])
const CONSENT_ARTIFACT_HINTS = ['consent', 'reconsent', 'icf']
const CRITICAL_ARTIFACT_HINTS = ['closeout', 'certification', 'unblinding', 'critical']

export function resolveSignaturePolicyCode(input: {
  artifactType?: string | null
  signatureMeaning?: string | null
  module?: string | null
}): SignaturePolicyCode {
  const artifact = `${input.artifactType ?? ''} ${input.module ?? ''}`.toLowerCase()
  const meaning = (input.signatureMeaning ?? '').toLowerCase()

  if (CRITICAL_MEANINGS.has(meaning) || CRITICAL_ARTIFACT_HINTS.some((hint) => artifact.includes(hint))) {
    return 'critical_signature'
  }
  if (CONSENT_ARTIFACT_HINTS.some((hint) => artifact.includes(hint))) {
    return meaning.includes('re') ? 'reconsent' : 'subject_consent'
  }
  if (meaning.includes('cosign') || meaning.includes('co_sign')) {
    return 'co_signature'
  }
  return 'standard_signature'
}

export function signaturePolicySummary(policy: SignaturePolicyRow | null | undefined): string {
  if (!policy) return 'Standard signature policy'
  const features = [
    policy.mfaRequired ? 'MFA' : null,
    policy.coSignatureRequired ? 'co-signature' : null,
    policy.subjectInvolvementRequired ? 'subject involvement' : null,
  ].filter(Boolean)
  return features.length ? `${policy.policyName} (${features.join(', ')})` : policy.policyName
}

export async function loadActiveSignaturePolicies(
  supabase: SupabaseClient,
): Promise<SignaturePolicyRow[]> {
  const { data, error } = await supabase
    .from('signature_policies')
    .select('policy_code, policy_name, description, allowed_roles, mfa_required, co_signature_required, signature_meaning_required, subject_involvement_required, active')
    .eq('active', true)
    .order('policy_code', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    policyCode: String(row.policy_code),
    policyName: String(row.policy_name),
    description: row.description ? String(row.description) : null,
    allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles.filter((item) => typeof item === 'string') : [],
    mfaRequired: row.mfa_required === true,
    coSignatureRequired: row.co_signature_required === true,
    signatureMeaningRequired: row.signature_meaning_required !== false,
    subjectInvolvementRequired: row.subject_involvement_required === true,
    active: row.active !== false,
  }))
}
