/**
 * Single typed entry point for read-layer queries.
 *
 * Wraps lib/supabase/server so future fan-out, retries, or instrumentation
 * can hang off this module without leaking into signals/*-signals.ts. PR2
 * will start using it; in PR1 it is just the re-export.
 */

import { createServerClient } from '@/lib/supabase/server'

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

export async function getReadLayerClient(): Promise<SupabaseServerClient> {
  return await createServerClient()
}
