'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { evaluatePharmacyDocumentDependencies } from '../phase1-document-hooks'
import type { PharmacyRuntimeBlueprint } from '../phase1-domain'
import { assertPharmacyActionGate } from './access'
import { insertPharmacyDocumentLinks } from './document-links'

type ReviewBlueprintPayload = {
  crcReviewNote?: string
}

type BlueprintDbRow = Record<string, unknown> & {
  id: string
  organization_id: string
  study_id: string
  site_id: string | null
  status: string
  source_document_id: string | null
  document_reader_artifact_id: string | null
  crc_reviewed_at: string | null
  crc_reviewed_by: string | null
  metadata?: Record<string, unknown> | null
}

export async function loadActivePharmacyBlueprint(
  studyId: string,
  siteId?: string | null,
  supabase?: SupabaseClient,
) {
  const gate = await assertPharmacyActionGate({
    studyId,
    siteId,
    action: 'inventory_review',
    resourceType: 'pharmacy_runtime_blueprint',
    supabase,
  })

  let query = gate.supabase
    .from('pharmacy_runtime_blueprints')
    .select('*')
    .eq('study_id', studyId)
    .eq('status', 'active')
  query = siteId ? query.eq('site_id', siteId) : query.is('site_id', null)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapBlueprintRow(data as Record<string, unknown>) : null
}

export async function validatePharmacyDocumentCenterLinkage(
  blueprintId: string,
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const blueprint = await loadBlueprintById(client, blueprintId)
  await assertPharmacyActionGate({
    studyId: blueprint.study_id,
    siteId: blueprint.site_id,
    action: 'inventory_review',
    resourceType: 'pharmacy_runtime_blueprint',
    resourceId: blueprintId,
    supabase: client,
  })

  return evaluatePharmacyDocumentDependencies(mapBlueprintRow(blueprint), [
    { role: 'packing_slip', required: true, document_id: blueprint.source_document_id },
    { role: 'depot_shipment_notice', required: true, document_id: blueprint.source_document_id },
    {
      role: 'chain_of_custody',
      required: false,
      document_id: blueprint.document_reader_artifact_id,
    },
  ])
}

export async function reviewPharmacyBlueprint(
  blueprintId: string,
  reviewPayload: ReviewBlueprintPayload = {},
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const blueprint = await loadBlueprintById(client, blueprintId)
  const gate = await assertPharmacyActionGate({
    studyId: blueprint.study_id,
    siteId: blueprint.site_id,
    action: 'inventory_review',
    resourceType: 'pharmacy_runtime_blueprint',
    resourceId: blueprintId,
    supabase: client,
  })

  const { data, error } = await client
    .from('pharmacy_runtime_blueprints')
    .update({
      status: 'reviewed',
      crc_reviewed_at: new Date().toISOString(),
      crc_reviewed_by: gate.actorId,
      metadata: { ...(blueprint.metadata ?? {}), crc_review_note: reviewPayload.crcReviewNote ?? null },
    })
    .eq('id', blueprintId)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to review Pharmacy blueprint')
  return mapBlueprintRow(data as Record<string, unknown>)
}

export async function activatePharmacyBlueprint(blueprintId: string, supabase?: SupabaseClient) {
  const client = supabase ?? (await createServerClient())
  const blueprint = await loadBlueprintById(client, blueprintId)
  const gate = await assertPharmacyActionGate({
    studyId: blueprint.study_id,
    siteId: blueprint.site_id,
    action: 'inventory_review',
    resourceType: 'pharmacy_runtime_blueprint',
    resourceId: blueprintId,
    supabase: client,
  })

  if (!blueprint.source_document_id || !blueprint.document_reader_artifact_id) {
    throw new Error('Document Center and Document Reader linkage are required before activation.')
  }
  if (!blueprint.crc_reviewed_at || !blueprint.crc_reviewed_by) {
    throw new Error('CRC review is required before Pharmacy blueprint activation.')
  }

  const { data, error } = await client
    .from('pharmacy_runtime_blueprints')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
      activated_by: gate.actorId,
    })
    .eq('id', blueprintId)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to activate Pharmacy blueprint')

  await insertPharmacyDocumentLinks(client, [
    {
      organizationId: blueprint.organization_id,
      studyId: blueprint.study_id,
      siteId: blueprint.site_id,
      entityType: 'pharmacy_runtime_blueprint',
      entityId: blueprintId,
      documentId: blueprint.source_document_id,
      documentReaderArtifactId: blueprint.document_reader_artifact_id,
      documentRole: 'source_document',
    },
  ], gate.actorId)

  return mapBlueprintRow(data as Record<string, unknown>)
}

async function loadBlueprintById(supabase: SupabaseClient, blueprintId: string) {
  const { data, error } = await supabase
    .from('pharmacy_runtime_blueprints')
    .select('*')
    .eq('id', blueprintId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Pharmacy Runtime Blueprint not found')
  return data as BlueprintDbRow
}

function mapBlueprintRow(row: Record<string, unknown>): PharmacyRuntimeBlueprint {
  return {
    blueprint_id: String(row.id),
    organization_id: String(row.organization_id),
    study_id: String(row.study_id),
    site_id: row.site_id ? String(row.site_id) : '',
    source: 'DOCUMENT_READER',
    document_center_id: String(row.source_document_id ?? ''),
    document_reader_run_id: String(row.document_reader_artifact_id ?? ''),
    crc_review_completed: Boolean(row.crc_reviewed_at && row.crc_reviewed_by),
    activation_status: row.status === 'generated' ? 'draft' : row.status as PharmacyRuntimeBlueprint['activation_status'],
    activated_at: row.activated_at ? String(row.activated_at) : null,
    activated_by: row.activated_by ? String(row.activated_by) : null,
  }
}
