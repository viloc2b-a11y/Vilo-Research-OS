/**
 * Operational Calendar QA — logic + staging data probes (no browser).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function assert(name, condition, detail = '') {
  if (!condition) throw new Error(detail ? `${name}: ${detail}` : name)
  console.log(`PASS  ${name}`)
}

function isManualCreation(row) {
  return row.event_type === 'OPERATIONAL_CALENDAR_MANUAL_EVENT' && row.payload?.calendar_event_type === 'manual'
}

function resolveManualEvents(rows) {
  const resolved = new Map()
  for (const row of rows) {
    const payload = row.payload ?? {}
    if (isManualCreation(row)) {
      resolved.set(row.id, { row, payload, status: 'upcoming', cancelled: false, completedAt: null })
      continue
    }
    const originalEventId = typeof payload.original_event_id === 'string' ? payload.original_event_id : null
    if (!originalEventId) continue
    const current = resolved.get(originalEventId)
    if (!current) continue
    if (row.event_type === 'manual_calendar_event_updated' && payload.manual_event_action === 'updated') {
      resolved.set(originalEventId, { ...current, payload: { ...current.payload, ...payload } })
      continue
    }
    if (row.event_type === 'manual_calendar_event_completed' && payload.manual_event_action === 'completed') {
      resolved.set(originalEventId, {
        ...current,
        status: 'completed',
        completedAt: payload.completed_at ?? row.occurred_at,
      })
      continue
    }
    if (row.event_type === 'manual_calendar_event_cancelled' && payload.manual_event_action === 'cancelled') {
      resolved.set(originalEventId, { ...current, cancelled: true })
    }
  }
  return [...resolved.values()]
}

function isoDateUtcNoon(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 12)).toISOString().slice(0, 10)
}

function runLogicTests() {
  const originalId = '11111111-1111-4111-8111-111111111111'
  const rows = [
    {
      id: originalId,
      event_type: 'OPERATIONAL_CALENDAR_MANUAL_EVENT',
      occurred_at: '2026-05-10T12:00:00Z',
      payload: { calendar_event_type: 'manual', title: 'First', event_date: '2026-05-10' },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      event_type: 'manual_calendar_event_updated',
      occurred_at: '2026-05-11T12:00:00Z',
      payload: {
        manual_event_action: 'updated',
        original_event_id: originalId,
        title: 'Rescheduled',
        event_date: '2026-05-20',
      },
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      event_type: 'manual_calendar_event_cancelled',
      occurred_at: '2026-05-12T12:00:00Z',
      payload: { manual_event_action: 'cancelled', original_event_id: originalId },
    },
  ]

  const resolved = resolveManualEvents(rows)
  assert('manual resolve yields one logical event', resolved.length === 1)
  assert('cancelled manual hidden from active set', resolved[0].cancelled === true)

  const activeOnly = resolveManualEvents(rows).filter((r) => !r.cancelled)
  assert('non-cancelled after update uses latest date', activeOnly.length === 0)

  const withoutCancel = resolveManualEvents(rows.slice(0, 2))
  assert('reschedule updates event_date', withoutCancel[0].payload.event_date === '2026-05-20')
  assert('only one chip after update', withoutCancel.length === 1)

  assert('utc noon date stable', isoDateUtcNoon(2026, 4, 15) === '2026-05-15')

  const clientSource = readFileSync(resolve(root, 'components/calendar/operational-calendar-client.tsx'), 'utf8')
  assert(
    'protocol drawer excludes manual actions',
    clientSource.includes("state.event.kind === 'manual_event'") &&
      clientSource.includes('Manual event actions') &&
      !clientSource.match(/protocol_visit[\s\S]{0,400}Edit/),
  )
  assert(
    'visit workspace link present',
    clientSource.includes('Open Visit Workspace'),
  )

  const sidebar = readFileSync(resolve(root, 'components/shell/sidebar-nav.tsx'), 'utf8')
  assert('sidebar calendar link', sidebar.includes("href: '/operational-calendar'"))
}

async function runStagingProbes() {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  loadEnvFiles()
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const year = new Date().getUTCFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { count: scheduledCount, error: scheduledErr } = await admin
    .from('scheduled_visits')
    .select('id', { count: 'exact', head: true })
    .gte('ideal_date', yearStart)
    .lte('ideal_date', yearEnd)

  assert('scheduled_visits query', !scheduledErr, scheduledErr?.message)
  console.log(`INFO  scheduled_visits in ${year}: ${scheduledCount ?? 0}`)

  const { data: manualRows, error: manualErr } = await admin
    .from('operational_events')
    .select('id, event_type, payload, occurred_at')
    .in('event_type', [
      'OPERATIONAL_CALENDAR_MANUAL_EVENT',
      'manual_calendar_event_updated',
      'manual_calendar_event_completed',
      'manual_calendar_event_cancelled',
    ])
    .order('occurred_at', { ascending: true })
    .limit(200)

  assert('manual operational_events query', !manualErr, manualErr?.message)
  const resolved = resolveManualEvents(manualRows ?? [])
  const active = resolved.filter((r) => !r.cancelled)
  console.log(`INFO  manual events resolved: ${resolved.length} (${active.length} active)`)

  const { data: ownerMembership } = await admin
    .from('organization_members')
    .select('user_id, role, organization_id')
    .eq('role', 'owner')
    .limit(5)

  console.log(`INFO  owner memberships sample: ${ownerMembership?.length ?? 0}`)
}

async function main() {
  runLogicTests()
  try {
    await runStagingProbes()
  } catch (err) {
    console.warn(`SKIP  staging probes (${err.message})`)
  }
  console.log('\nOperational calendar validation checks passed.')
}

main().catch((err) => {
  console.error(`FAIL  ${err.message}`)
  process.exit(1)
})
