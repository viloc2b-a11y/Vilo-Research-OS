import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type CountResult = { count: number; error: string | null }

export async function exactCount(
  run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<CountResult> {
  const { count, error } = await run()
  return { count: count ?? 0, error: error?.message ?? null }
}

export type { SupabaseServerClient }
