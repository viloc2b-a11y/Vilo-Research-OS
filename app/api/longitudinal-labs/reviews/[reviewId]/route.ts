import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { updateLabReportReview } from '@/lib/longitudinal-labs/update-lab-report-review'
import {
  type LabReportReviewStatus,
  type LabReportPiClassification,
} from '@/lib/longitudinal-labs/lab-report-review-types'

type RouteContext = { params: Promise<{ reviewId: string }> }

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_review: ['under_review', 'rejected'],
  under_review: ['reviewed', 'rejected', 'pending_review'],
}

const VALID_PI_CLASSIFICATIONS = new Set([
  'cs',
  'ncs',
  'follow_up_required',
])

function isAllowedTransition(
  current: string,
  next: string,
): boolean {
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed) return false
  return allowed.includes(next)
}

async function loadReview(
  supabase: SupabaseClient,
  reviewId: string,
) {
  const { data, error } = await supabase
    .from('lab_report_reviews')
    .select('id, organization_id, study_id, subject_id, review_status, signature_request_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { reviewId } = await context.params

  let body: {
    organization_id?: string
    study_id?: string
    review_status?: string
    pi_classification?: string | null
    review_notes?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createServerClient()

  const review = await loadReview(supabase, reviewId)
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  const organizationId = body.organization_id ?? String(review.organization_id)
  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const currentStatus = String(review.review_status)

  const updateInput: {
    reviewStatus?: LabReportReviewStatus
    piClassification?: LabReportPiClassification | null
    reviewNotes?: string | null
    reviewedBy?: string
    reviewedAt?: string
  } = {}

  if (body.review_status !== undefined) {
    if (!isAllowedTransition(currentStatus, body.review_status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${body.review_status}`,
        },
        { status: 400 },
      )
    }
    updateInput.reviewStatus = body.review_status as LabReportReviewStatus
  }

  if (body.pi_classification !== undefined) {
    if (body.pi_classification !== null && !VALID_PI_CLASSIFICATIONS.has(body.pi_classification)) {
      return NextResponse.json(
        { error: `Invalid pi_classification: ${body.pi_classification}` },
        { status: 400 },
      )
    }

    if (body.pi_classification !== null) {
      updateInput.piClassification = body.pi_classification as LabReportPiClassification
      updateInput.reviewedBy = auth.user.id
      updateInput.reviewedAt = new Date().toISOString()
    } else {
      updateInput.piClassification = null
    }
  }

  if (body.review_notes !== undefined) {
    updateInput.reviewNotes = body.review_notes ?? null
  }

  if (Object.keys(updateInput).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await updateLabReportReview(supabase, reviewId, organizationId, updateInput)
    return NextResponse.json({ ok: true, review: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update review'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
