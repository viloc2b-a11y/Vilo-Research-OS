/**
 * Query-layer runtime isolation — call before Supabase reads of denied tables.
 */

import type { RuntimeActorClassification } from '@/lib/external-access/actor-classification'
import { DENIED_RUNTIME_TABLE, type DeniedRuntimeTable } from '@/lib/external-access/denied-runtime-resources'
import { assertRuntimeProjectionQueryAllowed } from '@/lib/external-access/runtime-isolation'

export const RUNTIME_QUERY_RESOURCE = {
  ...DENIED_RUNTIME_TABLE,
  SOURCE_RESPONSE_SET_HISTORY: 'source_response_set_history',
  SOURCE_RESPONSE_SET_MANIFEST: 'source_response_set_manifest',
  SITE_REPLAY_REVIEW: 'site_replay_review',
} as const

export type RuntimeQueryResource = DeniedRuntimeTable | (typeof RUNTIME_QUERY_RESOURCE)[keyof typeof RUNTIME_QUERY_RESOURCE]

export function guardRuntimeTableQuery(
  resource: RuntimeQueryResource,
  actor: RuntimeActorClassification,
): void {
  assertRuntimeProjectionQueryAllowed(resource, actor)
}

export function guardCoordinatorLoaderAccess(
  actor: RuntimeActorClassification,
  organizationId: string,
): void {
  if (!organizationId.trim()) {
    throw new Error('guardCoordinatorLoaderAccess requires organizationId')
  }
  guardRuntimeTableQuery(RUNTIME_QUERY_RESOURCE.VISIT_ORCHESTRATION, actor)
}
