/**
 * Phase 5.1A — Thin Supabase RPC caller (no table writes).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { fromRpcEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import type { ApiEnvelope, RpcEnvelope } from '@/lib/api/source/types'

export async function callSourceRpc<T>(
  supabase: SupabaseClient,
  rpcName: string,
  args: Record<string, unknown>,
  requestId: string,
): Promise<ApiEnvelope<T | null>> {
  const { data, error } = await supabase.rpc(rpcName, args)
  if (error) {
    return fromRpcThrown(error, { requestId, rpc: rpcName })
  }
  return fromRpcEnvelope(data as RpcEnvelope<T> | T | null, { requestId, rpc: rpcName })
}
