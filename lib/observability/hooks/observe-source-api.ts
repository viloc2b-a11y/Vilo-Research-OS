/**
 * OBS-2 — Source API route observability helpers (non-blocking).
 */

import type { ApiEnvelope } from '@/lib/api/source/types'
import {
  observeSourceDraftSaved,
  observeSourceResponseSetOpened,
  observeSourceResponseSetSubmitted,
  observeSourceValidationFailed,
  type SourceCaptureScope,
} from '@/lib/observability/hooks/observe-source-capture'
import { resolveSourceCaptureScopeFromResponseSet } from '@/lib/observability/hooks/resolve-source-capture-scope'
import {
  captureSourceSnapshotBestEffort,
  SOURCE_SNAPSHOT_TYPE,
} from '@/lib/source/integrity'
import type { SupabaseClient } from '@supabase/supabase-js'

const VALIDATION_ERROR_PREFIXES = [
  'REQUIRED_FIELD',
  'VALUE_TYPE',
  'FIELD_BINDING',
  'UNRESOLVED_FINDINGS',
  'SOURCE_VALIDATION',
]

function hasValidationSignal(envelope: ApiEnvelope<unknown>): boolean {
  if (!envelope.ok && envelope.errors.length > 0) {
    return envelope.errors.some((err) =>
      VALIDATION_ERROR_PREFIXES.some((prefix) => String(err.code).includes(prefix)),
    )
  }
  return envelope.warnings.some((warn) =>
    VALIDATION_ERROR_PREFIXES.some((prefix) => String(warn.code).includes(prefix)),
  )
}

export function observeSourceApiOpenResult(input: {
  scope: SourceCaptureScope
  envelope: ApiEnvelope<unknown>
}): void {
  if (!input.envelope.ok) return
  observeSourceResponseSetOpened(input.scope)
}

export async function observeSourceApiDraftResult(input: {
  supabase: SupabaseClient
  organizationId: string
  sourceResponseSetId: string
  actorUserId: string | null
  envelope: ApiEnvelope<unknown>
}): Promise<void> {
  const scope = await resolveSourceCaptureScopeFromResponseSet({
    supabase: input.supabase,
    organizationId: input.organizationId,
    sourceResponseSetId: input.sourceResponseSetId,
    actorUserId: input.actorUserId,
  })
  if (!scope) return

  if (input.envelope.ok) {
    observeSourceDraftSaved(scope)
    return
  }

  if (hasValidationSignal(input.envelope)) {
    observeSourceValidationFailed(scope, {
      errorCodes: input.envelope.errors.map((e) => String(e.code)),
      hardBlockCount: input.envelope.meta.hardBlockCount,
    })
  }
}

export async function observeSourceApiSubmitResult(input: {
  supabase: SupabaseClient
  organizationId: string
  sourceResponseSetId: string
  actorUserId: string | null
  envelope: ApiEnvelope<unknown>
}): Promise<void> {
  const scope = await resolveSourceCaptureScopeFromResponseSet({
    supabase: input.supabase,
    organizationId: input.organizationId,
    sourceResponseSetId: input.sourceResponseSetId,
    actorUserId: input.actorUserId,
  })
  if (!scope) return

  if (input.envelope.ok) {
    observeSourceResponseSetSubmitted(scope)
    if (input.actorUserId) {
      captureSourceSnapshotBestEffort({
        scope: {
          supabase: scope.supabase,
          organizationId: scope.organizationId,
          studyId: scope.studyId,
          studySubjectId: scope.studySubjectId,
          visitId: scope.visitId,
          procedureExecutionId: scope.procedureExecutionId,
          sourceResponseSetId: input.sourceResponseSetId,
          actorUserId: input.actorUserId,
        },
        snapshotType: SOURCE_SNAPSHOT_TYPE.SUBMIT,
      })
    }
    return
  }

  if (hasValidationSignal(input.envelope)) {
    observeSourceValidationFailed(scope, {
      errorCodes: input.envelope.errors.map((e) => String(e.code)),
      hardBlockCount: input.envelope.meta.hardBlockCount,
    })
  }
}
