import { describe, test, expect } from 'vitest'
import type { CoordinatorWorkload } from '@/lib/performance/portfolio/compute-coordinator-workload'
import type { CoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkloadRow(overrides: Partial<CoordinatorWorkload> = {}): CoordinatorWorkload {
  return {
    coordinatorId: 'coord-1',
    assignedSubjectCount: 10,
    activeVisitCount: 5,
    overdueSourceCount: 0,
    openFindingsCount: 2,
    openQueriesCount: 3,
    workloadScore: 57,
    tier: 'busy',
    ...overrides,
  }
}

function makeRecruitmentStats(overrides: Partial<CoordinatorRecruitmentStats> = {}): CoordinatorRecruitmentStats {
  return {
    actor_id: 'coord-1',
    leads_assigned: 8,
    leads_advanced_in_period: 3,
    contact_attempts_in_period: 0,
    pre_screens_completed: 2,
    qualified_in_period: 1,
    conversion_rate: 1 / 8,
    period_days: 30,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Merge helper — simulates what the page does when merging rows
// ---------------------------------------------------------------------------

function mergeRecruitment(
  workloads: CoordinatorWorkload[],
  stats: CoordinatorRecruitmentStats[],
): CoordinatorWorkload[] {
  const byActorId = new Map(stats.map((s) => [s.actor_id, s]))
  return workloads.map((w) => ({
    ...w,
    recruitment: byActorId.get(w.coordinatorId),
  }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Coordinator workload + recruitment merge', () => {
  test('merged row contains recruitment sub-object when stats exist for that coordinator', () => {
    const workloads = [makeWorkloadRow()]
    const stats = [makeRecruitmentStats()]
    const merged = mergeRecruitment(workloads, stats)

    expect(merged[0].recruitment).toBeDefined()
    expect(merged[0].recruitment?.actor_id).toBe('coord-1')
    expect(merged[0].recruitment?.leads_assigned).toBe(8)
  })

  test('merged row has recruitment = undefined when no stats exist for that coordinator', () => {
    const workloads = [makeWorkloadRow({ coordinatorId: 'coord-no-stats' })]
    const stats = [makeRecruitmentStats({ actor_id: 'coord-other' })]
    const merged = mergeRecruitment(workloads, stats)

    expect(merged[0].recruitment).toBeUndefined()
  })

  test('existing clinical fields are unchanged after merge', () => {
    const original = makeWorkloadRow({
      assignedSubjectCount: 12,
      activeVisitCount: 7,
      openFindingsCount: 4,
      openQueriesCount: 6,
      workloadScore: 81,
      tier: 'overloaded',
    })
    const merged = mergeRecruitment([original], [makeRecruitmentStats()])

    const row = merged[0]
    expect(row.assignedSubjectCount).toBe(12)
    expect(row.activeVisitCount).toBe(7)
    expect(row.openFindingsCount).toBe(4)
    expect(row.openQueriesCount).toBe(6)
    expect(row.workloadScore).toBe(81)
    expect(row.tier).toBe('overloaded')
  })

  test('multiple coordinators each get their own recruitment stats', () => {
    const workloads = [
      makeWorkloadRow({ coordinatorId: 'coord-1' }),
      makeWorkloadRow({ coordinatorId: 'coord-2' }),
    ]
    const stats = [
      makeRecruitmentStats({ actor_id: 'coord-1', leads_assigned: 5 }),
      makeRecruitmentStats({ actor_id: 'coord-2', leads_assigned: 12 }),
    ]
    const merged = mergeRecruitment(workloads, stats)

    expect(merged[0].recruitment?.leads_assigned).toBe(5)
    expect(merged[1].recruitment?.leads_assigned).toBe(12)
  })

  test('coordinator with recruitment stats has workloadScore unaffected by recruitment data', () => {
    const workloads = [makeWorkloadRow({ workloadScore: 42, tier: 'normal' })]
    const stats = [makeRecruitmentStats({ qualified_in_period: 100 })]
    const merged = mergeRecruitment(workloads, stats)

    // workloadScore is purely clinical — recruitment does not change it
    expect(merged[0].workloadScore).toBe(42)
    expect(merged[0].tier).toBe('normal')
  })
})
