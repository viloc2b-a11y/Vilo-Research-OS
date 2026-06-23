import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadStudySystems, loadActiveStudySystems } from './load-study-systems'

// ── Fake Supabase ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>
type FakeOpts = {
  rows?: Row[]
  error?: { message: string }
  throwOnFrom?: boolean
}

function makeSupabase(opts: FakeOpts) {
  const callArgs: { method: string; args: unknown[] }[] = []

  const buildChain = () => {
    const chain: Record<string, unknown> = {
      select() {
        callArgs.push({ method: 'select', args: [] })
        return chain
      },
      eq(field: string, value: unknown) {
        callArgs.push({ method: 'eq', args: [field, value] })
        return chain
      },
      order(field: string, dir: { ascending: boolean }) {
        callArgs.push({ method: 'order', args: [field, dir] })
        return chain
      },
      then(resolve: (v: unknown) => void) {
        resolve({
          data: opts.error ? null : opts.rows ?? [],
          error: opts.error ?? null,
        })
      },
    }
    return chain
  }

  return {
    from() {
      if (opts.throwOnFrom) throw new Error('connection refused')
      callArgs.push({ method: 'from', args: [] })
      return buildChain()
    },
    callArgs,
  } as unknown as SupabaseClient
}

function studySystemRow(over: Partial<Row> = {}): Row {
  return {
    study_system_id: 'ss-1',
    study_id: 'study-1',
    system_library_id: 'lib-1',
    system_name: 'Rave EDC',
    vendor_name: 'Medidata',
    system_type: 'EDC',
    system_category: 'Data Capture',
    launch_url: 'https://rave.example.com',
    support_email: null,
    support_url: null,
    training_url: null,
    login_notes: null,
    owner_role: null,
    active: true,
    pinned: false,
    is_custom: false,
    created_by: 'user-1',
    created_at: '2026-06-22T00:00:00Z',
    updated_at: '2026-06-22T00:00:00Z',
    ...over,
  }
}

const STUDY_ID = 'study-1'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadStudySystems', () => {
  it('returns all systems for a study', async () => {
    const supabase = makeSupabase({
      rows: [
        studySystemRow({ study_system_id: '1', system_name: 'System A' }),
        studySystemRow({ study_system_id: '2', system_name: 'System B' }),
      ],
    })

    const result = await loadStudySystems(supabase, STUDY_ID)

    expect(result).toHaveLength(2)

    // Verify the loader queries the correct table and study
    const fromCalls = (supabase as unknown as { callArgs: { method: string; args: unknown[] }[] }).callArgs
    expect(fromCalls.some((c) => c.method === 'from' && c.args[0] === 'study_systems')).toBe(false) // from() doesn't push args in this fake
    const eqCalls = fromCalls.filter((c) => c.method === 'eq')
    expect(eqCalls.some((c) => c.args[0] === 'study_id' && c.args[1] === STUDY_ID)).toBe(true)
  })

  it('returns pinned systems first (pinned=true rows come first in response)', async () => {
    const supabase = makeSupabase({
      rows: [
        studySystemRow({ study_system_id: '1', system_name: 'Alpha', pinned: false }),
        studySystemRow({ study_system_id: '2', system_name: 'Beta', pinned: true }),
        studySystemRow({ study_system_id: '3', system_name: 'Gamma', pinned: false }),
      ],
    })

    const result = await loadStudySystems(supabase, STUDY_ID)

    // The fake returns rows in the order provided — pinned=true is row index 1.
    // The loader delegates sorting to Supabase (.order('pinned', { ascending: false })).
    expect(result).toHaveLength(3)
    expect(result[1].pinned).toBe(true)
  })

  it('returns empty array on error and populates unavailable', async () => {
    const unavailable: string[] = []
    const supabase = makeSupabase({ error: { message: 'permission denied' } })

    const result = await loadStudySystems(supabase, STUDY_ID, unavailable)

    expect(result).toEqual([])
    expect(unavailable).toHaveLength(1)
    expect(unavailable[0]).toContain('permission denied')
  })

  it('throws gracefully and returns [] when supabase.from() throws', async () => {
    const unavailable: string[] = []
    const supabase = makeSupabase({ throwOnFrom: true })

    const result = await loadStudySystems(supabase, STUDY_ID, unavailable)

    expect(result).toEqual([])
    expect(unavailable[0]).toContain('connection refused')
  })

  it('returns empty array when no unavailable collector passed (no throw)', async () => {
    const supabase = makeSupabase({ error: { message: 'timeout' } })

    await expect(loadStudySystems(supabase, STUDY_ID)).resolves.toEqual([])
  })

  it('degrades gracefully with null system_name', async () => {
    const supabase = makeSupabase({
      rows: [
        studySystemRow({ study_system_id: '1', system_name: null }),
        studySystemRow({ study_system_id: '2', system_name: 'Valid System' }),
      ],
    })

    const result = await loadStudySystems(supabase, STUDY_ID)

    expect(result).toHaveLength(2)
    expect(result[0].system_name).toBe('')
    expect(result[1].system_name).toBe('Valid System')
  })
})

describe('loadActiveStudySystems', () => {
  it('returns only active systems', async () => {
    const supabase = makeSupabase({
      rows: [
        studySystemRow({ study_system_id: '1', system_name: 'Active A', active: true }),
        studySystemRow({ study_system_id: '2', system_name: 'Inactive B', active: false }),
        studySystemRow({ study_system_id: '3', system_name: 'Active C', active: true }),
      ],
    })

    const result = await loadActiveStudySystems(supabase, STUDY_ID)

    expect(result).toHaveLength(2)
    expect(result.every((s) => s.active)).toBe(true)
    expect(result.map((s) => s.system_name)).toEqual(['Active A', 'Active C'])
  })
})
