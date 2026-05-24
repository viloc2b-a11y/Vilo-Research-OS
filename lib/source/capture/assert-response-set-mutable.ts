import { STALE_WRITE_USER_MESSAGE } from '@/lib/concurrency/stale-write'
import { coordinatorMessageFromError } from '@/lib/runtime-errors'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

const MUTABLE_STATUSES = new Set(['draft', 'in_progress'])

export async function assertSourceResponseSetMutable(params: {
  supabase: Supabase
  responseSetId: string
  organizationId: string
  expectedUpdatedAt?: string | null
}) {
  const { data, error } = await params.supabase
    .from('source_response_sets')
    .select('id, status, updated_at, procedure_execution_id')
    .eq('id', params.responseSetId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()

  if (error) {
    return {
      ok: false as const,
      message: coordinatorMessageFromError(error, {
        context: 'assert_response_set_mutable',
        fallbackMessage: 'Could not verify source capture status.',
      }),
    }
  }
  if (!data) return { ok: false as const, message: 'Response set not found.' }

  const status = data.status as string
  if (!MUTABLE_STATUSES.has(status)) {
    return {
      ok: false as const,
      message:
        'Source capture is no longer editable (submitted, signed, or locked). Refresh the page.',
    }
  }

  const serverUpdatedAt = (data.updated_at as string | null) ?? null
  if (
    params.expectedUpdatedAt
    && serverUpdatedAt
    && params.expectedUpdatedAt !== serverUpdatedAt
  ) {
    return { ok: false as const, message: STALE_WRITE_USER_MESSAGE }
  }

  return { ok: true as const, row: data }
}
