import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { createOperationalSignatureRequest } from '@/lib/operational-signatures/create-signature-request'
import { updateLabReportReview } from '@/lib/longitudinal-labs/update-lab-report-review'
import { OperationalSignatureStateError } from '@/lib/operational-signatures/operational-signature-errors'
import { canReviewSourceDocuments } from '@/lib/rbac/permissions'

type RouteContext = { params: Promise<{ reviewId: string }> }

async function loadReview(
  supabase: SupabaseClient,
  reviewId: string,
) {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select('*')
    .eq('id', reviewId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { reviewId } = await context.params

  const supabase = await createServerClient()

  const review = await loadReview(supabase, reviewId)
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  const organizationId = String(review.organization_id)
  const studyId = String(review.study_id)
  const subjectId = String(review.subject_id)

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  if (!canReviewSourceDocuments(auth.memberships, organizationId)) {
    return NextResponse.json(
      { error: 'Not authorized to request signature.' },
      { status: 403 },
    )
  }

  const existingRequestId = review.signature_request_id
  if (existingRequestId) {
    const { data: existing } = await supabase
      .from('operational_signature_requests')
      .select('id, status')
      .eq('id', String(existingRequestId))
      .maybeSingle()

    if (existing && (existing as Record<string, unknown>).status === 'pending') {
      return NextResponse.json(
        { error: 'An active signature request already exists for this review' },
        { status: 409 },
      )
    }
  }

  try {
    const signatureRequest = await createOperationalSignatureRequest(supabase, {
      organizationId,
      studyId,
      subjectId: subjectId ?? null,
      visitId: review.visit_id ? String(review.visit_id) : null,
      artifactType: 'lab_report',
      artifactId: reviewId,
      requiredRole: 'pi_sub_i',
      signatureMeaning: 'reviewed_by',
      requestedBy: auth.user.id,
      metadata: {
        compliance_document_id: review.compliance_document_id ?? null,
        report_type: review.report_type ?? null,
      },
    })

    await updateLabReportReview(supabase, reviewId, organizationId, {
      signatureRequestId: signatureRequest.id,
    })

    return NextResponse.json({ ok: true, signatureRequest })
  } catch (error) {
    if (error instanceof OperationalSignatureStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message =
      error instanceof Error ? error.message : 'Failed to request signature'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
