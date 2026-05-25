import { createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RuntimeProjectionPersistContext = {
  table: string
  organizationId: string
  studyId: string
  studySubjectId?: string | null
  visitId?: string | null
}

/**
 * Server-only Supabase client for derived runtime projection cache writes.
 * Never import from Client Components or expose to external actors.
 */
export async function getRuntimeProjectionServiceClient(): Promise<SupabaseClient> {
  if (typeof window !== 'undefined') {
    throw new Error('getRuntimeProjectionServiceClient is server-only')
  }
  return createServiceClient()
}

/**
 * Persist rebuildable projection rows via service role. Failures are logged and swallowed
 * so coordinator page loads continue with in-memory computed data.
 */
export async function persistDerivedProjectionSafe(
  context: RuntimeProjectionPersistContext,
  write: (supabase: SupabaseClient) => Promise<{ error: { message: string } | null }>,
): Promise<boolean> {
  try {
    const supabase = await getRuntimeProjectionServiceClient()
    const { error } = await write(supabase)
    if (error) {
      console.warn('[runtime-projections] derived persist failed', {
        table: context.table,
        organizationId: context.organizationId,
        studyId: context.studyId,
        studySubjectId: context.studySubjectId ?? null,
        visitId: context.visitId ?? null,
        message: error.message,
      })
      return false
    }
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[runtime-projections] derived persist exception', {
      table: context.table,
      organizationId: context.organizationId,
      studyId: context.studyId,
      studySubjectId: context.studySubjectId ?? null,
      visitId: context.visitId ?? null,
      message,
    })
    return false
  }
}
