import type { SupabaseClient } from '@supabase/supabase-js'
import { OperationalSignatureStateError } from './operational-signature-errors'
import type { OperationalSignatureRequestRow } from './operational-signature-types'

export const OPERATIONAL_SIGNATURE_TEST_FIXTURE_ARTIFACT_TYPE =
  'operational_signature_test_fixture'

export type LoadedOperationalSignatureArtifact = {
  artifactType: string
  artifactId: string
  payload: Record<string, unknown>
}

type ArtifactLoader = (
  supabase: SupabaseClient,
  request: OperationalSignatureRequestRow,
) => Promise<LoadedOperationalSignatureArtifact>

const artifactLoaders: Record<string, ArtifactLoader> = {
  [OPERATIONAL_SIGNATURE_TEST_FIXTURE_ARTIFACT_TYPE]: async (_supabase, request) => {
    const fixture = request.metadata.operational_signature_test_fixture
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
      throw new OperationalSignatureStateError(
        'Trusted test fixture artifact payload is missing from the persisted request.',
      )
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: fixture as Record<string, unknown>,
    }
  },
}

export async function loadOperationalSignatureArtifactForHash(
  supabase: SupabaseClient,
  request: OperationalSignatureRequestRow,
): Promise<LoadedOperationalSignatureArtifact> {
  const loader = artifactLoaders[request.artifactType]
  if (!loader) {
    throw new OperationalSignatureStateError(
      `Unsupported operational signature artifact type: ${request.artifactType}. Trusted server-side artifact loader is required before signing.`,
    )
  }

  return loader(supabase, request)
}
