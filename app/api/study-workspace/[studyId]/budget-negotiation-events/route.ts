import { NextRequest, NextResponse } from 'next/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import {
  appendStudyBudgetNegotiationEvent,
  loadRecentBudgetNegotiationLedger,
  type StudyBudgetNegotiationEventType,
} from '@/lib/study-workspace/load-budget-evidence-summary'

type RouteContext = { params: Promise<{ studyId: string }> }

function parseEventType(value: unknown): StudyBudgetNegotiationEventType | null {
  const allowed: StudyBudgetNegotiationEventType[] = [
    'sponsor_offer_received',
    'counteroffer_drafted',
    'counteroffer_sent',
    'sponsor_reply_received',
    'term_accepted',
    'term_rejected',
    'term_adjusted',
    'evidence_linked',
  ]
  if (typeof value !== 'string') return null
  return allowed.includes(value as StudyBudgetNegotiationEventType)
    ? (value as StudyBudgetNegotiationEventType)
    : null
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { studyId } = await context.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: study } = await supabase
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  const organizationId = String(study.organization_id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '5')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 25) : 5
  const unavailable: string[] = []

  try {
    const events = await loadRecentBudgetNegotiationLedger({
      supabase,
      organizationId,
      studyId,
      unavailable,
      limit,
    })
    return NextResponse.json({ ok: true, events, unavailable })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load negotiation ledger'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { studyId } = await context.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: study } = await supabase
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  const organizationId = String(study.organization_id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const eventType = parseEventType(body.event_type)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
  if (!eventType) {
    return NextResponse.json({ error: 'event_type is required and must be valid' }, { status: 400 })
  }
  if (!title || !summary) {
    return NextResponse.json({ error: 'title and summary are required' }, { status: 400 })
  }

  try {
    const event = await appendStudyBudgetNegotiationEvent({
      supabase,
      organizationId,
      studyId,
      eventType,
      title,
      summary,
      reason: typeof body.reason === 'string' ? body.reason.trim() || null : null,
      recommendedNextStep:
        typeof body.recommended_next_step === 'string'
          ? body.recommended_next_step.trim() || null
          : null,
      ownerRole: typeof body.owner_role === 'string' ? body.owner_role.trim() || 'coordinator' : 'coordinator',
      negotiationRound:
        typeof body.negotiation_round === 'number' && Number.isFinite(body.negotiation_round)
          ? Math.max(1, Math.trunc(body.negotiation_round))
          : 1,
      protocolVersionId:
        typeof body.protocol_version_id === 'string' ? body.protocol_version_id.trim() || null : null,
      studySubjectId:
        typeof body.study_subject_id === 'string' ? body.study_subject_id.trim() || null : null,
      visitId: typeof body.visit_id === 'string' ? body.visit_id.trim() || null : null,
      procedureId: typeof body.procedure_id === 'string' ? body.procedure_id.trim() || null : null,
      sourceDocumentId:
        typeof body.source_document_id === 'string' ? body.source_document_id.trim() || null : null,
      sourceChunkId:
        typeof body.source_chunk_id === 'string' ? body.source_chunk_id.trim() || null : null,
      actorUserId: user.id,
      eventPayload:
        body.event_payload && typeof body.event_payload === 'object' && !Array.isArray(body.event_payload)
          ? (body.event_payload as Record<string, unknown>)
          : {},
    })

    return NextResponse.json({ ok: true, event }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to append negotiation event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
