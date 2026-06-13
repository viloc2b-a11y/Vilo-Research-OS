import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { canAccessOrganization } from '@/lib/auth/membership-access'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import { ingestComplianceDocument } from '@/lib/document-intake/ingest-document'
import { validateDocumentUpload } from '@/lib/document-intake/validate-document-upload'
import { validateDestinationMetadata } from '@/lib/document-intake/validate-destination-metadata'
import type { DestinationDomain, DocumentClassification } from '@/lib/document-intake/compliance-types'

function clean(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const organizationId = clean(formData.get('organization_id'))

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization_id' }, { status: 400 })
    }

    const memberships = await getOrganizationMemberships(user.id)
    if (!canAccessOrganization(memberships, organizationId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!canManageSourceDocuments(memberships, organizationId)) {
      return NextResponse.json({ error: 'Your role does not allow document intake.' }, { status: 403 })
    }

    const validation = validateDocumentUpload(file)
    if (!validation.ok || !file) {
      return NextResponse.json({ error: validation.message || 'Invalid file' }, { status: 400 })
    }

    const documentClassification = clean(formData.get('document_classification')) as DocumentClassification | null
    const destinationDomain = clean(formData.get('destination_domain')) as DestinationDomain | null
    const destinationEntityType = clean(formData.get('destination_entity_type'))
    const destinationEntityId = clean(formData.get('destination_entity_id'))

    if (!documentClassification) {
      return NextResponse.json({ error: 'Missing document classification' }, { status: 400 })
    }

    const destinationValidation = validateDestinationMetadata({
      destinationDomain,
      destinationEntityType,
      destinationEntityId,
    })
    if (!destinationValidation.ok) {
      return NextResponse.json({ error: destinationValidation.message }, { status: 400 })
    }

    const studyId = clean(formData.get('study_id'))
    const subjectId = clean(formData.get('subject_id'))
    const visitId = clean(formData.get('visit_id'))
    const procedureExecutionId = clean(formData.get('procedure_execution_id'))
    const operationalDisplayName = clean(formData.get('operational_display_name')) ?? file.name
    const expirationDate = clean(formData.get('expiration_date'))
    const certifiedCopyAttested = clean(formData.get('certified_copy_attested')) === 'true'
    const operationalNotes = clean(formData.get('operational_notes'))

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const supabase = await createServerClient()

    const result = await ingestComplianceDocument({
      supabase,
      file,
      fileBuffer,
      organizationId,
      studyId,
      subjectId,
      visitId,
      procedureExecutionId,
      documentClassification,
      destinationDomain: destinationDomain!,
      destinationEntityType: destinationEntityType!,
      destinationEntityId,
      operationalDisplayName,
      expirationDate,
      certifiedCopyAttested,
      operationalNotes,
      actorId: user.id,
      actorRole: null,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      labReviewRouting: result.labReviewRouting ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Document intake upload error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
