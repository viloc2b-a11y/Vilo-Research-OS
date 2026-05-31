'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type PharmacyActionName =
  | 'receipt'
  | 'inventory_review'
  | 'inventory_reconciliation'
  | 'correction'
  | 'dispense'
  | 'return'
  | 'destruction'

export type PharmacyActionGateInput = {
  studyId: string
  siteId?: string | null
  action: PharmacyActionName
  resourceType?: string
  resourceId?: string | null
  supabase?: SupabaseClient
}

export type PharmacyActionGateResult = {
  supabase: SupabaseClient
  actorId: string
  studyId: string
  siteId: string | null
  organizationId: string
  authorizationScope: string
  allowed: true
}

export async function assertPharmacyActionGate(
  input: PharmacyActionGateInput,
): Promise<PharmacyActionGateResult> {
  const supabase = input.supabase ?? (await createServerClient())
  const actor = await requireActor(supabase)
  const study = await loadStudyScope(supabase, input.studyId)
  const siteId = input.siteId ?? null

  const allowed = await rpcBoolean(supabase, 'pharmacy_user_can_access_action', {
    _study_id: input.studyId,
    _site_id: siteId,
    _action: input.action,
  })

  const authorizationScope = await rpcText(supabase, 'pharmacy_user_authorization_scope', {
    _study_id: input.studyId,
    _site_id: siteId,
  })

  await auditPharmacyAccess(supabase, {
    organizationId: study.organization_id,
    studyId: input.studyId,
    siteId,
    action: input.action,
    resourceType: input.resourceType ?? 'pharmacy_runtime',
    resourceId: input.resourceId ?? null,
    allowed,
    reason: allowed ? 'access gate satisfied' : 'study/site/delegation/training/blinding gate failed',
  })

  if (!allowed) {
    throw new Error('Pharmacy access denied: study/site/delegation/training/blinding gate failed.')
  }

  return {
    supabase,
    actorId: actor.id,
    studyId: input.studyId,
    siteId,
    organizationId: study.organization_id,
    authorizationScope,
    allowed: true,
  }
}

export async function assertPharmacyUnblindedReadGate(input: Omit<PharmacyActionGateInput, 'action'>) {
  const gate = await assertPharmacyActionGate({ ...input, action: 'inventory_review' })
  const canView = await rpcBoolean(gate.supabase, 'pharmacy_user_can_view_unblinded_ip', {
    _study_id: input.studyId,
    _site_id: input.siteId ?? null,
  })

  await auditPharmacyAccess(gate.supabase, {
    organizationId: gate.organizationId,
    studyId: input.studyId,
    siteId: input.siteId ?? null,
    action: 'inventory_review',
    resourceType: input.resourceType ?? 'ip_inventory_projection_unblinded',
    resourceId: input.resourceId ?? null,
    allowed: canView,
    reason: canView ? 'unblinded read gate satisfied' : 'unblinded read gate failed',
  })

  if (!canView) {
    throw new Error('Pharmacy access denied: unblinded inventory requires study authorization scope.')
  }

  return gate
}

export async function loadMaskedInventoryProjection(
  studyId: string,
  siteId?: string | null,
  supabase?: SupabaseClient,
) {
  const gate = await assertPharmacyActionGate({
    studyId,
    siteId,
    action: 'inventory_review',
    resourceType: 'ip_inventory_projection_masked',
    supabase,
  })

  let query = gate.supabase.from('ip_inventory_projection_masked').select('*').eq('study_id', studyId)
  if (siteId) query = query.eq('site_id', siteId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function loadUnblindedInventoryProjection(
  studyId: string,
  siteId?: string | null,
  supabase?: SupabaseClient,
) {
  const gate = await assertPharmacyUnblindedReadGate({
    studyId,
    siteId,
    resourceType: 'ip_inventory_projection_unblinded',
    supabase,
  })

  let query = gate.supabase.from('ip_inventory_projection_unblinded').select('*').eq('study_id', studyId)
  if (siteId) query = query.eq('site_id', siteId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

async function requireActor(supabase: SupabaseClient): Promise<{ id: string }> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Unauthorized')
  return { id: data.user.id }
}

async function loadStudyScope(supabase: SupabaseClient, studyId: string): Promise<{ organization_id: string }> {
  const { data, error } = await supabase
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Study not found')
  return data as { organization_id: string }
}

async function rpcBoolean(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data === true
}

async function rpcText(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return typeof data === 'string' ? data : 'none'
}

async function auditPharmacyAccess(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    studyId: string
    siteId: string | null
    action: string
    resourceType: string
    resourceId: string | null
    allowed: boolean
    reason: string
  },
) {
  await supabase.rpc('ip_access_audit_log', {
    _organization_id: input.organizationId,
    _study_id: input.studyId,
    _site_id: input.siteId,
    _requested_action: input.action,
    _resource_type: input.resourceType,
    _resource_id: input.resourceId,
    _allowed: input.allowed,
    _reason: input.reason,
    _metadata: {},
  })
}
