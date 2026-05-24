/**
 * Break-glass request validation (v0).
 */

import { isWorkflowAuthorityLevel } from '@/lib/governance/workflow-authority/constants'
import {
  BREAK_GLASS_APPROVAL_MODE,
  isBreakGlassApprovalModeV0Supported,
} from '@/lib/break-glass/constants'
import type { BreakGlassAccessRequestInput } from '@/lib/break-glass/types'

const JUSTIFICATION_PHI_PATTERN =
  /(subject|patient|mrn|ssn|date_of_birth|\bdob\b|phi_)/i

export function validateBreakGlassAccessRequest(
  input: BreakGlassAccessRequestInput,
): string[] {
  const errors: string[] = []

  if (!input.studyId) {
    errors.push('study_id is required in v0 to emit BREAK_GLASS_ACCESS_REQUESTED on the operational spine')
  }

  if (!input.justification || input.justification.trim().length < 8) {
    errors.push('justification is required (minimum 8 characters)')
  } else if (JUSTIFICATION_PHI_PATTERN.test(input.justification)) {
    errors.push('justification must not contain PHI-like identifiers')
  }

  if (!isBreakGlassApprovalModeV0Supported(input.approvalMode)) {
    errors.push(
      `approval_mode "${input.approvalMode}" is not supported in v0 (use ${BREAK_GLASS_APPROVAL_MODE.SELF_GRANTED})`,
    )
  }

  if (
    input.effectiveAuthorityLevel != null &&
    input.baseAuthorityLevel == null
  ) {
    errors.push('base_authority_level is required when effective_authority_level is set')
  }

  if (input.baseAuthorityLevel != null && !isWorkflowAuthorityLevel(input.baseAuthorityLevel)) {
    errors.push(`invalid base_authority_level: ${input.baseAuthorityLevel}`)
  }

  if (
    input.effectiveAuthorityLevel != null &&
    !isWorkflowAuthorityLevel(input.effectiveAuthorityLevel)
  ) {
    errors.push(`invalid effective_authority_level: ${input.effectiveAuthorityLevel}`)
  }

  const expiresAt =
    input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) {
    errors.push('expires_at must be a valid timestamp')
  } else if (expiresAt.getTime() <= Date.now()) {
    errors.push('expires_at must be in the future')
  }

  return errors
}
