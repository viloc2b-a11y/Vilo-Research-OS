import type { OrganizationMembership } from '../lib/auth/session'
import { filterUnblindedRows } from '../lib/rbac/blinding'

type MockLoadedEvent = {
  id: string
  eventType: string
  payload: Record<string, unknown>
  actorUserId: string
  occurredAt: string
  visitId: string | null
  procedureExecutionId: string | null
}

async function smokeTestAuditTrail() {
  console.log('--- H5 Phase 5: Audit Trail Smoke Test ---')

  const loadedEvents: MockLoadedEvent[] = [
    {
      id: 'mock-1',
      eventType: 'SUBJECT_RANDOMIZED',
      payload: { reason: 'Randomized successfully' },
      actorUserId: 'mock-user',
      occurredAt: new Date().toISOString(),
      visitId: null,
      procedureExecutionId: null,
    },
    {
      id: 'mock-2',
      eventType: 'SNAPSHOT_GENERATED',
      payload: { file_name: 'visit-pdf.pdf' },
      actorUserId: 'mock-user',
      occurredAt: new Date().toISOString(),
      visitId: null,
      procedureExecutionId: null,
    }
  ]

  console.log(`Loaded ${loadedEvents.length} mock events.`)

  // 3. Test safe summary extraction
  const summaries = loadedEvents.map((e) => {
    const p = e.payload
    let summary = 'System action recorded.'
    if (typeof p.reason === 'string') summary = p.reason
    else if (typeof p.note_preview === 'string') summary = p.note_preview
    else if (typeof p.file_name === 'string') summary = p.file_name
    else if (typeof p.status === 'string') summary = p.status
    else if (typeof p.title === 'string') summary = p.title
    return summary
  })

  console.log('Sample summaries:', summaries)

  const sampleEvent = {
    organization_id: 'org-123',
    study_id: 'study-123',
  }

  // 4. Test blinding filters directly
  const unblindedPayload = {
    is_unblinded: true,
    randomization_number: '1234',
    reason: 'Subject randomized',
  }

  const rawRows = [
    {
      id: 'mock-1',
      event_type: 'SUBJECT_RANDOMIZED',
      payload: unblindedPayload,
      actor_user_id: 'mock-user',
      occurred_at: new Date().toISOString(),
      visit_id: null,
      procedure_execution_id: null,
    }
  ]

  // Mock blinded membership
  const blindedMemberships: OrganizationMembership[] = [
    {
      organization_id: sampleEvent.organization_id,
      role: 'research_coordinator',
      roles: ['research_coordinator'],
      status: 'active',
      organizations: {
        id: sampleEvent.organization_id,
        name: 'Mock Org',
      },
    },
  ]

  // Should remove the row entirely
  const redacted = filterUnblindedRows(rawRows, blindedMemberships, sampleEvent.organization_id)
  
  if (redacted.length > 0) {
    throw new Error('Blinding filter failed to filter unblinded row')
  }

  console.log('Blinding filter passed (redacted payload appropriately).')
  console.log('--- Test Passed ---')
}

smokeTestAuditTrail().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
