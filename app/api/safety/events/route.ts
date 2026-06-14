import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { createSafetyEvent } from '@/lib/safety-runtime/create-safety-event'
import { triggerSafetyDeviationBridge } from '@/lib/safety-runtime/trigger-safety-deviation'
import {
  mapSafetyEventRow,
  mapSafetyEventTaskRow,
  SAFETY_EVENT_TYPE,
  type SafetyEventRow,
  type SafetyEventTask,
  type SafetyEventType,
  type SafetyEventStatus,
  type CreateSafetyEventInput,
} from '@/lib/safety-runtime/safety-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const studyId = searchParams.get('study_id') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const eventType = searchParams.get('event_type') ?? undefined

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    let eventsQuery = supabase
      .from('safety_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('opened_at', { ascending: false })
      .limit(100)

    if (studyId) {
      eventsQuery = eventsQuery.eq('study_id', studyId)
    }
    if (status) {
      eventsQuery = eventsQuery.eq('event_status', status as SafetyEventStatus)
    }
    if (eventType) {
      eventsQuery = eventsQuery.eq('event_type', eventType as SafetyEventType)
    }

    const { data: eventRows, error: eventsError } = await eventsQuery

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    const events: SafetyEventRow[] = (eventRows ?? []).map((row) =>
      mapSafetyEventRow(row as Record<string, unknown>),
    )

    // Load open tasks for these events
    const eventIds = events.map((e) => e.id)
    const openTasksByEventId: Record<string, SafetyEventTask[]> = {}

    if (eventIds.length > 0) {
      const { data: taskRows, error: tasksError } = await supabase
        .from('safety_event_tasks')
        .select('*')
        .in('safety_event_id', eventIds)
        .in('status', ['open', 'overdue'])

      if (tasksError) {
        return NextResponse.json({ error: tasksError.message }, { status: 500 })
      }

      for (const row of taskRows ?? []) {
        const task = mapSafetyEventTaskRow(row as Record<string, unknown>)
        if (!openTasksByEventId[task.safetyEventId]) {
          openTasksByEventId[task.safetyEventId] = []
        }
        openTasksByEventId[task.safetyEventId].push(task)
      }
    }

    return NextResponse.json({ events, openTasksByEventId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: { organization_id?: string; input?: CreateSafetyEventInput }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id: organizationId, input } = body

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id is required' },
      { status: 400 },
    )
  }

  if (!input) {
    return NextResponse.json(
      { error: 'input is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    const event = await createSafetyEvent(supabase, auth.user.id, input)

    // Auto-generate 15-day reporting deadline task for SAEs
    if (event.eventType === SAFETY_EVENT_TYPE.SAE) {
      const openedAt = new Date(event.openedAt)
      const dueDate = new Date(openedAt)
      dueDate.setDate(dueDate.getDate() + 15)
      const dueDateStr = dueDate.toISOString().slice(0, 10)

      const now = new Date().toISOString()
      await supabase.from('safety_event_tasks').insert({
        organization_id: organizationId,
        safety_event_id: event.id,
        task_type: '15_day_report',
        due_date: dueDateStr,
        status: 'open',
        created_at: now,
      })

      // Trigger SAE → Protocol Deviation bridge (idempotent).
      await triggerSafetyDeviationBridge({ supabase, safetyEvent: event, actorId: auth.user.id })
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
