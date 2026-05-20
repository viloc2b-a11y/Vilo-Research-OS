/**
 * Declarative signature & Part 11 policy — no DB triggers in Phase 1.
 */

import type { AuditPolicy, SignatureRequirement, SignatureRole } from '@/lib/source-engine/definitions/types'
import type { RuntimeContext } from '@/lib/source-engine/runtime/runtime-context'

export const DEFAULT_AUDIT_POLICY: AuditPolicy = {
  id: 'vilo_default_audit',
  immutableAfterSign: true,
  requireReasonOnCorrection: true,
  requireReasonOnAddendum: true,
  brokenSignatureOnPostSignEdit: true,
  eventTypes: [
    'field_captured',
    'field_corrected',
    'field_addendum',
    'section_row_added',
    'section_row_removed',
    'signature_applied',
    'signature_broken',
    'validation_executed',
    'source_locked',
    'source_submitted',
  ],
}

export const DEFAULT_SIGNATURE_REQUIREMENTS: SignatureRequirement[] = [
  {
    role: 'coordinator',
    label: 'Coordinator attestation',
    required: true,
    lockAfterSign: false,
  },
  {
    role: 'principal_investigator',
    label: 'Principal Investigator',
    required: true,
    lockAfterSign: true,
  },
  {
    role: 'sub_investigator',
    label: 'Sub-Investigator',
    required: false,
    lockAfterSign: true,
  },
]

export type SignaturePolicy = {
  id: string
  requirements: SignatureRequirement[]
  auditPolicy: AuditPolicy
  /** Roles allowed to sign in correction mode */
  correctionAllowedRoles: SignatureRole[]
}

export const DEFAULT_SIGNATURE_POLICY: SignaturePolicy = {
  id: 'vilo_default_signature',
  requirements: DEFAULT_SIGNATURE_REQUIREMENTS,
  auditPolicy: DEFAULT_AUDIT_POLICY,
  correctionAllowedRoles: ['coordinator', 'principal_investigator', 'sub_investigator'],
}

export function canEditSource(context: RuntimeContext, policy: SignaturePolicy = DEFAULT_SIGNATURE_POLICY): boolean {
  if (!context.locked && context.signatureState === 'unsigned') return true
  if (context.correctionMode || context.addendumMode) {
    return policy.correctionAllowedRoles.includes(context.userRole as SignatureRole)
  }
  return false
}

export function shouldBreakSignature(
  context: RuntimeContext,
  policy: SignaturePolicy = DEFAULT_SIGNATURE_POLICY,
): boolean {
  return (
    policy.auditPolicy.brokenSignatureOnPostSignEdit &&
    context.signatureState === 'signed' &&
    (context.correctionMode !== true && context.addendumMode !== true)
  )
}

export function requiresReasonForChange(
  context: RuntimeContext,
  policy: SignaturePolicy = DEFAULT_SIGNATURE_POLICY,
): boolean {
  if (context.correctionMode) return policy.auditPolicy.requireReasonOnCorrection
  if (context.addendumMode) return policy.auditPolicy.requireReasonOnAddendum
  return false
}
