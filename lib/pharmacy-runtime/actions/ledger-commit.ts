'use server'

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createOperationalSignatureRequest } from '@/lib/operational-signatures/create-signature-request'
import type { Phase1LedgerEvent } from '../phase1-domain'

export type PharmacySignatureBoundaryInput = {
  organizationId: string
  studyId: string
  artifactType: 'ip_receipt' | 'ip_correction'
  artifactId: string
  requestedBy: string
  signatureRequestId?: string | null
  metadata?: Record<string, unknown>
}

export type PharmacySignatureBoundaryResult =
  | { status: 'signature_required'; signatureRequestId: string }
  | { status: 'signed'; signatureId: string; signatureRequestId: string }

export async function resolvePharmacySignatureBoundary(
  supabase: SupabaseClient,
  input: PharmacySignatureBoundaryInput,
): Promise<PharmacySignatureBoundaryResult> {
  if (!input.signatureRequestId) {
    const request = await createOperationalSignatureRequest(supabase, {
      organizationId: input.organizationId,
      studyId: input.studyId,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      requiredRole: 'research_coordinator',
      signatureMeaning: 'approved_by',
      requestedBy: input.requestedBy,
      metadata: input.metadata,
    })
    return { status: 'signature_required', signatureRequestId: request.id }
  }

  const { data: request, error: requestError } = await supabase
    .from('operational_signature_requests')
    .select('id,status,artifact_type,artifact_id')
    .eq('id', input.signatureRequestId)
    .single()
  if (requestError || !request) throw new Error(requestError?.message ?? 'Signature request not found')
  if (request.status !== 'signed') {
    return { status: 'signature_required', signatureRequestId: input.signatureRequestId }
  }
  if (request.artifact_type !== input.artifactType || request.artifact_id !== input.artifactId) {
    throw new Error('Signed operational signature request does not match Pharmacy artifact.')
  }

  const { data: signature, error: signatureError } = await supabase
    .from('operational_signatures')
    .select('id')
    .eq('request_id', input.signatureRequestId)
    .eq('status', 'signed')
    .single()
  if (signatureError || !signature) {
    throw new Error(signatureError?.message ?? 'Signed operational signature was not found.')
  }

  return {
    status: 'signed',
    signatureId: String(signature.id),
    signatureRequestId: input.signatureRequestId,
  }
}

export async function commitIpReceiptTransaction(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('commit_ip_receipt_with_signature', { _payload: payload })
  if (error) throw new Error(error.message)
  return data
}

export async function commitIpCorrectionTransaction(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('commit_ip_correction_with_signature', { _payload: payload })
  if (error) throw new Error(error.message)
  return data
}

export function withDbLedgerIds(events: Phase1LedgerEvent[]): Phase1LedgerEvent[] {
  const idMap = new Map<string, string>()
  for (const event of events) idMap.set(event.event_id, normalizeUuid(event.event_id))

  return events.map((event) => ({
    ...event,
    event_id: idMap.get(event.event_id) ?? randomUUID(),
    reverses_event_id: event.reverses_event_id ? idMap.get(event.reverses_event_id) ?? event.reverses_event_id : null,
    supersedes_event_id: event.supersedes_event_id
      ? idMap.get(event.supersedes_event_id) ?? event.supersedes_event_id
      : null,
  }))
}

function normalizeUuid(value: string): string {
  return isUuid(value) ? value : randomUUID()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
