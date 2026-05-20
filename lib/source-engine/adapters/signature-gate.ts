/**
 * Phase 3B — Source Engine signature readiness helpers.
 */

import type { CaptureValidationError } from '@/lib/source-engine/adapters/source-response-adapter'

export function getSignatureBlockingErrors(
  errors: CaptureValidationError[],
): CaptureValidationError[] {
  return errors.filter((e) => e.blocksSignature)
}

export function formatEngineSignatureBlockMessage(
  blockers: CaptureValidationError[],
): string {
  const lines = blockers.map((e) => {
    const loc = e.fieldKey ?? e.sectionId ?? 'form'
    return `- [${loc}] ${e.message}`
  })
  return ['Signature blocked by Source Engine validation:', ...lines].join('\n')
}
