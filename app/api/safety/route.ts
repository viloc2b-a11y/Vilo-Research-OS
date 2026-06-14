import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { loadSafetyEvents } from '@/lib/safety-runtime/load-safety-events'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const studyId = searchParams.get('study_id') ?? undefined

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
    const events = await loadSafetyEvents(supabase, { organizationId, studyId })

    if (events.length === 0) {
      return NextResponse.json({ events: [], tasks_by_event: {} })
    }

    const eventIds = events.map((e) => e.id)

    const { data: taskRows, error: taskError } = await supabase
      .from('safety_event_tasks')
      .select('safety_event_id, status')
      .in('safety_event_id', eventIds)

    if (taskError) {
      throw new Error(taskError.message)
    }

    // Count open tasks per event
    const tasksCountByEvent: Record<string, number> = {}
    for (const row of taskRows ?? []) {
      const eventId = row.safety_event_id as string
      const status = row.status as string
      if (status === 'open' || status === 'overdue') {
        tasksCountByEvent[eventId] = (tasksCountByEvent[eventId] ?? 0) + 1
      }
    }

    return NextResponse.json({ events, tasks_by_event: tasksCountByEvent })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
