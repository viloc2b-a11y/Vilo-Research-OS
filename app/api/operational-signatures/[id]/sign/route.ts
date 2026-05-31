import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  OPERATIONAL_SIGNATURE_WARNING,
  OperationalSignatureStateError,
  signOperationalArtifact,
} from '@/lib/operational-signatures'
import { authorizeOperationalSignatureWrite } from '@/lib/operational-signatures/operational-signature-auth'
import { writeProfileEvent } from '@/lib/subject/clinical-profile/audit'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  let body: {
    organization_id?: string
    action?: 'sign' | 'reject' | 'rescind'
    reason?: string
    explicit_user_action?: boolean
    confirmation_statement?: string
    metadata?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }
  if ((body.action === 'reject' || body.action === 'rescind') && !body.reason?.trim()) {
    return NextResponse.json({ error: `${body.action} reason is required` }, { status: 400 })
  }
  if (body.action === 'reject' || body.action === 'rescind') {
    const auth = await authorizeOperationalSignatureWrite(body.organization_id)
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
    const supabase = await createServerClient()
    const { data: before } = await supabase
      .from('operational_signature_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!before) return NextResponse.json({ error: 'Signature request not found' }, { status: 404 })
    const status = body.action === 'reject' ? 'rejected' : 'rescinded'
    const displayStatus = body.action === 'reject' ? 'Rejected' : 'Rescinded'
    const metadata = ((before.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>
    const { data, error } = await supabase
      .from('operational_signature_requests')
      .update({
        status,
        metadata: {
          ...metadata,
          display_status: displayStatus,
          [`${status}_reason`]: body.reason,
          [`${status}_by`]: auth.userId,
          [`${status}_at`]: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (before.artifact_type === 'subject_document') {
      await supabase
        .from('subject_documents')
        .update({ status: displayStatus })
        .eq('document_id', before.artifact_id)
    }
    if (before.subject_id) {
      await writeProfileEvent({
        study_subject_id: before.subject_id,
        section: 'subject_signatures',
        record_id: id,
        event_type: 'status_changed',
        before_snapshot: before,
        after_snapshot: data,
        change_reason: body.reason,
        source_attribution: 'Operational Signature Inbox',
      })
    }
    return NextResponse.json({ ok: true, request: data })
  }
  if (!body.explicit_user_action || body.confirmation_statement !== OPERATIONAL_SIGNATURE_WARNING) {
    return NextResponse.json({ error: 'Explicit signature confirmation is required' }, { status: 400 })
  }

  const auth = await authorizeOperationalSignatureWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent')

  try {
    const { data: beforeRequest } = await supabase
      .from('operational_signature_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    const signature = await signOperationalArtifact(supabase, {
      requestId: id,
      signerUserId: auth.userId,
      signerMemberships: auth.memberships,
      explicitUserAction: body.explicit_user_action,
      confirmationStatement: body.confirmation_statement,
      ipAddress,
      userAgent,
      metadata: body.metadata,
    })
    if (beforeRequest?.artifact_type === 'subject_document') {
      await supabase
        .from('subject_documents')
        .update({ status: 'Signed' })
        .eq('document_id', beforeRequest.artifact_id)
      if (beforeRequest.subject_id) {
        await writeProfileEvent({
          study_subject_id: beforeRequest.subject_id,
          section: 'subject_signatures',
          record_id: id,
          event_type: 'status_changed',
          before_snapshot: beforeRequest,
          after_snapshot: signature as unknown as Record<string, unknown>,
          change_reason: null,
          source_attribution: 'Operational Signature Inbox',
        })
      }
    }
    return NextResponse.json({ ok: true, signature })
  } catch (error) {
    if (error instanceof OperationalSignatureStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to sign artifact'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
