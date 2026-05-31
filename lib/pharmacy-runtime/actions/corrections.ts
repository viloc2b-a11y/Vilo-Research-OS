'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { buildPhase1CorrectionEvents } from '../phase1-ledger'
import type { Phase1CorrectionInput, Phase1LedgerEvent } from '../phase1-domain'
import { assertPharmacyActionGate } from './access'
import type { PharmacyDocumentLinkInput } from './document-links'
import {
  commitIpCorrectionTransaction,
  resolvePharmacySignatureBoundary,
  withDbLedgerIds,
} from './ledger-commit'

export type CreateIpCorrectionPreviewInput = Omit<Phase1CorrectionInput, 'signature_id'> & {
  signature_id?: string
}

export type CommitIpCorrectionInput = Omit<Phase1CorrectionInput, 'signature_id'> & {
  signatureRequestId?: string | null
  blueprintId: string
  organizationId: string
  studyId: string
  siteId: string | null
  documentLinks?: Omit<PharmacyDocumentLinkInput, 'organizationId' | 'studyId' | 'siteId' | 'entityType' | 'entityId'>[]
  accountabilityExceptionId?: string | null
  accountabilityExceptionStatus?: 'open' | 'investigating' | 'resolved' | 'closed' | null
}

export function createIpCorrectionPreview(input: CreateIpCorrectionPreviewInput) {
  const events = buildPhase1CorrectionEvents({
    ...input,
    signature_id: input.signature_id ?? 'PREVIEW_SIGNATURE_NOT_COMMITTED',
  })
  return {
    correctionId: input.correction_id,
    willPersist: false,
    eventCount: events.length,
    events,
  }
}

export async function commitIpCorrectionWithSignature(input: CommitIpCorrectionInput, supabase?: SupabaseClient) {
  assertPhase1CorrectionTarget(input.target_event)

  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.studyId,
    siteId: input.siteId,
    action: 'correction',
    resourceType: 'ip_correction',
    resourceId: input.correction_id,
    supabase: client,
  })

  const signature = await resolvePharmacySignatureBoundary(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    artifactType: 'ip_correction',
    artifactId: input.correction_id,
    requestedBy: gate.actorId,
    signatureRequestId: input.signatureRequestId,
    metadata: {
      correction_scope: input.scope,
      target_event_id: input.target_event.event_id,
    },
  })
  if (signature.status === 'signature_required') return { ok: false as const, ...signature }

  const correctionInput: Phase1CorrectionInput = {
    ...input,
    corrected_by: gate.actorId,
    signature_id: signature.signatureId,
  }
  const events = withDbLedgerIds(buildPhase1CorrectionEvents(correctionInput).map((event) => ({
    ...event,
    organization_id: input.organizationId,
    study_id: input.studyId,
    site_id: input.siteId ?? '',
    payload: { ...event.payload, blueprint_id: input.blueprintId },
  })))

  const result = await commitIpCorrectionTransaction(client, {
    organization_id: input.organizationId,
    study_id: input.studyId,
    site_id: input.siteId,
    blueprint_id: input.blueprintId,
    correction_id: input.correction_id,
    target_event_id: input.target_event.event_id,
    scope: input.scope,
    reason: input.reason,
    justification: input.justification,
    signature_id: signature.signatureId,
    signature_request_id: signature.signatureRequestId,
    ledger_events: events.map((event) => ({
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
      reverses_event_id: event.reverses_event_id,
      supersedes_event_id: event.supersedes_event_id,
      record_hash: event.record_hash,
    })),
    document_links: (input.documentLinks ?? []).map((link) => ({
      document_id: link.documentId,
      document_reader_artifact_id: link.documentReaderArtifactId ?? null,
      document_role: link.documentRole,
    })),
    accountability_exception_id: input.accountabilityExceptionId ?? null,
    accountability_exception_status: input.accountabilityExceptionStatus ?? null,
  })

  return {
    ok: true as const,
    result,
    signatureId: signature.signatureId,
  }
}

function assertPhase1CorrectionTarget(event: Phase1LedgerEvent) {
  const allowed = [
    'receipt_verified',
    'receipt_quarantined',
    'receipt_discrepancy_recorded',
    'inventory_location_assigned',
    'kit_quarantined',
  ]
  if (!allowed.includes(event.event_type)) {
    throw new Error('Phase 1 correction is limited to receipt/inventory/accountability foundation events.')
  }
}
