'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { buildPhase1ReceiptLedgerEvents } from '../phase1-ledger'
import type {
  Phase1ReceiptExpectation,
  Phase1ReceiptInput,
  Phase1ReceiptItemInput,
  PharmacyRuntimeBlueprint,
} from '../phase1-domain'
import { assertPharmacyActionGate } from './access'
import type { PharmacyDocumentLinkInput } from './document-links'
import {
  commitIpReceiptTransaction,
  resolvePharmacySignatureBoundary,
  withDbLedgerIds,
} from './ledger-commit'

export type CreateIpReceiptPreviewInput = Omit<Phase1ReceiptInput, 'signature_id'> & {
  signature_id?: string
}

export type CommitIpReceiptInput = Omit<Phase1ReceiptInput, 'signature_id'> & {
  signatureRequestId?: string | null
  documentLinks?: Omit<PharmacyDocumentLinkInput, 'organizationId' | 'studyId' | 'siteId' | 'entityType' | 'entityId'>[]
}

export function createIpReceiptPreview(input: CreateIpReceiptPreviewInput) {
  const events = buildPhase1ReceiptLedgerEvents({
    ...input,
    signature_id: input.signature_id ?? 'PREVIEW_SIGNATURE_NOT_COMMITTED',
  })
  return {
    receiptId: input.receipt_id,
    willPersist: false,
    eventCount: events.length,
    events,
  }
}

export async function commitIpReceiptWithSignature(input: CommitIpReceiptInput, supabase?: SupabaseClient) {
  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.study_id,
    siteId: input.site_id,
    action: 'receipt',
    resourceType: 'ip_receipt',
    resourceId: input.receipt_id,
    supabase: client,
  })

  const signature = await resolvePharmacySignatureBoundary(client, {
    organizationId: input.organization_id,
    studyId: input.study_id,
    artifactType: 'ip_receipt',
    artifactId: input.receipt_id,
    requestedBy: gate.actorId,
    signatureRequestId: input.signatureRequestId,
    metadata: { shipment_id: input.shipment_id },
  })
  if (signature.status === 'signature_required') return { ok: false as const, ...signature }

  const receiptInput: Phase1ReceiptInput = {
    ...input,
    received_by: gate.actorId,
    signature_id: signature.signatureId,
  }
  const receiptEvents = withDbLedgerIds(buildPhase1ReceiptLedgerEvents(receiptInput).map((event) => ({
    ...event,
    payload: { ...event.payload, blueprint_id: input.blueprint.blueprint_id },
  }))).filter((event) => (
    event.event_type === 'receipt_verified'
    || event.event_type === 'receipt_quarantined'
    || event.event_type === 'receipt_discrepancy_recorded'
  ))

  const result = await commitIpReceiptTransaction(client, {
    organization_id: input.organization_id,
    study_id: input.study_id,
    site_id: input.site_id || null,
    blueprint_id: input.blueprint.blueprint_id,
    receipt_id: input.receipt_id,
    shipment_id: input.shipment_id,
    received_at: input.occurred_at,
    status: resolveReceiptStatus(input.items),
    discrepancy_summary: summarizeReceiptDiscrepancies(input.items),
    signature_id: signature.signatureId,
    signature_request_id: signature.signatureRequestId,
    receipt_items: input.items.map((item) => ({
      shipment_item_id: item.expectation_id,
      kit_id: item.kit_id,
      lot_number: item.lot_number,
      location_id: item.location_id,
      received_quantity: item.received_quantity,
      condition: item.condition,
      discrepancy_reason: item.discrepancy_reason ?? null,
    })),
    ledger_events: receiptEvents.map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      event_version: event.event_version,
      occurred_at: event.occurred_at,
      recorded_at: event.recorded_at,
      kit_id: event.kit_id,
      lot_number: event.lot_number,
      location_id: event.location_id,
      quantity_delta: event.quantity_delta,
      status_delta: event.status_delta,
      payload_json: event.payload,
      record_hash: event.record_hash,
    })),
    document_links: (input.documentLinks ?? []).map((link) => ({
      document_id: link.documentId,
      document_reader_artifact_id: link.documentReaderArtifactId ?? null,
      document_role: link.documentRole,
    })),
    metadata: {
      committed_by: gate.actorId,
      commit_boundary: 'commit_ip_receipt_with_signature',
    },
  })

  return { ok: true as const, result, signatureId: signature.signatureId }
}

export async function recordIpReceiptDiscrepancy(input: CommitIpReceiptInput, supabase?: SupabaseClient) {
  const discrepant = input.items.filter((item) => item.condition !== 'intact')
  if (discrepant.length === 0) throw new Error('Receipt discrepancy requires at least one non-intact item.')
  return commitIpReceiptWithSignature({ ...input, items: discrepant }, supabase)
}

export async function quarantineIpReceiptItem(input: CommitIpReceiptInput, supabase?: SupabaseClient) {
  const quarantined = input.items.map((item) => ({
    ...item,
    condition: item.condition === 'intact' ? 'damaged' as const : item.condition,
    discrepancy_reason: item.discrepancy_reason ?? 'Item quarantined during receipt verification.',
  }))
  return commitIpReceiptWithSignature({ ...input, items: quarantined }, supabase)
}

function resolveReceiptStatus(items: Phase1ReceiptItemInput[]) {
  if (items.some((item) => item.condition === 'damaged')) return 'quarantined'
  if (items.some((item) => item.condition !== 'intact')) return 'verified'
  return 'verified'
}

function summarizeReceiptDiscrepancies(items: Phase1ReceiptItemInput[]) {
  const reasons = items.map((item) => item.discrepancy_reason).filter(Boolean)
  return reasons.length ? reasons.join('; ') : null
}

export type { Phase1ReceiptExpectation, PharmacyRuntimeBlueprint }
