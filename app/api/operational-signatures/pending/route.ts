import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listPendingOperationalSignatures } from '@/lib/operational-signatures'
import { authorizeOperationalSignatureRead } from '@/lib/operational-signatures/operational-signature-auth'
import { writeProfileEvent } from '@/lib/subject/clinical-profile/audit'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const organizationId = searchParams.get('organization_id')?.trim()
  const studyId = searchParams.get('study_id')?.trim() || null

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeOperationalSignatureRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const requests = await listPendingOperationalSignatures(supabase, {
      organizationId,
      studyId,
      assignedUserId: auth.userId,
    })
    let reviewQuery = supabase
      .from('subject_document_review_requests')
      .select('request_id, organization_id, study_id, study_subject_id, document_id, request_type, requested_by, requested_to, message, due_date, status, created_at')
      .eq('organization_id', organizationId)
      .eq('requested_to', auth.userId)
      .in('status', ['Review Requested', 'Requested', 'Viewed'])
      .order('created_at', { ascending: false })
      .limit(100)
    if (studyId) reviewQuery = reviewQuery.eq('study_id', studyId)
    const { data: reviewRequests, error: reviewError } = await reviewQuery
    if (reviewError) throw new Error(reviewError.message)
    return NextResponse.json({ ok: true, requests, reviewRequests: reviewRequests ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list pending signatures'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    request_id?: string
    status?: 'Viewed' | 'Reviewed' | 'Rejected' | 'Rescinded'
    reason?: string
    notify_requester?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.organization_id || !body.request_id || !body.status) {
    return NextResponse.json({ error: 'organization_id, request_id, and status are required' }, { status: 400 })
  }
  if ((body.status === 'Rejected' || body.status === 'Rescinded') && !body.reason?.trim()) {
    return NextResponse.json({ error: `${body.status} reason is required` }, { status: 400 })
  }
  const auth = await authorizeOperationalSignatureRead(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
  const supabase = await createServerClient()
  const { data: before } = await supabase
    .from('subject_document_review_requests')
    .select('*')
    .eq('request_id', body.request_id)
    .eq('requested_to', auth.userId)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: 'Review request not found' }, { status: 404 })
  const history = Array.isArray(before.status_history) ? before.status_history : []
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: body.status,
    status_history: [...history, { status: body.status, timestamp: now, by: auth.userId, reason: body.reason ?? null }],
  }
  if (body.status === 'Reviewed') {
    patch.completed_by = auth.userId
    patch.completed_at = now
  }
  if (body.status === 'Rejected') {
    patch.rejection_reason = body.reason
    patch.rejected_by = auth.userId
    patch.rejected_at = now
    patch.rejection_notified_to_requester = body.notify_requester ?? false
    patch.rejection_notified_date = body.notify_requester ? now.slice(0, 10) : null
  }
  if (body.status === 'Rescinded') {
    patch.rescind_reason = body.reason
    patch.rescinded_by = auth.userId
    patch.rescinded_at = now
  }
  const { data, error } = await supabase
    .from('subject_document_review_requests')
    .update(patch)
    .eq('request_id', body.request_id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('subject_documents').update({ status: body.status }).eq('document_id', data.document_id)
  await writeProfileEvent({
    study_subject_id: data.study_subject_id,
    section: 'document_reviews',
    record_id: data.request_id,
    event_type: 'status_changed',
    before_snapshot: before,
    after_snapshot: data,
    change_reason: body.reason ?? null,
    source_attribution: 'Operational Signature Inbox',
  })
  return NextResponse.json({ ok: true, request: data })
}
