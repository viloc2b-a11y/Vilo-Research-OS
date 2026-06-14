import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { updateSafetyEvent } from '@/lib/safety-runtime/update-safety-event'
import { triggerSafetyDeviationBridge } from '@/lib/safety-runtime/trigger-safety-deviation'
import {
  mapSafetyEventRow,
  SAFETY_EVENT_TYPE,
  type UpdateSafetyEventInput,
} from '@/lib/safety-runtime/safety-types'

type RouteParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { eventId } = await params
  const url = new URL(_request.url)
  const organizationId = url.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('safety_events')
    .select('*')
    .eq('id', eventId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ event: mapSafetyEventRow(data as Record<string, unknown>) })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { eventId } = await params

  let body: { organization_id?: string; input?: UpdateSafetyEventInput }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id: organizationId, input } = body

  if (!organizationId || !input) {
    return NextResponse.json({ error: 'organization_id and input are required' }, { status: 400 })
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  try {
    const event = await updateSafetyEvent(supabase, eventId, organizationId, auth.user.id, input)

    // When classification changes to SAE, trigger the deviation bridge.
    if (input.eventType === SAFETY_EVENT_TYPE.SAE) {
      await triggerSafetyDeviationBridge({ supabase, safetyEvent: event, actorId: auth.user.id })
    }

    return NextResponse.json({ event })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
