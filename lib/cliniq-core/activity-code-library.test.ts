import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadActivityCodeCatalog } from './activity-code-library'

// ── Fake Supabase ─────────────────────────────────────────────────────────────
// loadActivityCodeCatalog issues two queries against `activity_code_library`:
//   .select(...).is('organization_id', null)          → global rows
//   .select(...).eq('organization_id', organizationId) → org rows
// This fake resolves those two terminal calls and can inject errors or throws.

type Row = Record<string, unknown>
type FakeOpts = {
  global?: Row[]
  org?: Row[]
  globalError?: { message: string }
  orgError?: { message: string }
  throwOnFrom?: boolean
}

function makeSupabase(opts: FakeOpts): SupabaseClient {
  return {
    from() {
      if (opts.throwOnFrom) throw new Error('connection refused')
      return {
        select() {
          return {
            is: () =>
              Promise.resolve({
                data: opts.globalError ? null : opts.global ?? [],
                error: opts.globalError ?? null,
              }),
            eq: () =>
              Promise.resolve({
                data: opts.orgError ? null : opts.org ?? [],
                error: opts.orgError ?? null,
              }),
          }
        },
      }
    },
  } as unknown as SupabaseClient
}

function globalRow(over: Partial<Row> = {}): Row {
  return {
    id: 'g1',
    code: 'CODE',
    name: 'Global Name',
    category: 'operational',
    sub_category: null,
    typical_unit: 'flat',
    fmv_low: null,
    fmv_high: null,
    organization_id: null,
    notes: null,
    ...over,
  }
}

const ORG = 'org-123'

describe('loadActivityCodeCatalog', () => {
  it('merges distinct global + org codes', async () => {
    const supabase = makeSupabase({
      global: [globalRow({ id: 'g1', code: 'GLOBAL_A', name: 'Alpha' })],
      org: [globalRow({ id: 'o1', code: 'ORG_B', name: 'Bravo', organization_id: ORG })],
    })
    const result = await loadActivityCodeCatalog(supabase, ORG)
    expect(result.map((e) => e.code).sort()).toEqual(['GLOBAL_A', 'ORG_B'])
  })

  it('org row wins over a global row sharing the same code', async () => {
    const supabase = makeSupabase({
      global: [globalRow({ id: 'g1', code: 'COORD_HOUR', name: 'Global Coordinator', fmv_low: 50 })],
      org: [
        globalRow({
          id: 'o1',
          code: 'COORD_HOUR',
          name: 'Org Coordinator',
          fmv_low: 70,
          organization_id: ORG,
        }),
      ],
    })
    const result = await loadActivityCodeCatalog(supabase, ORG)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Org Coordinator')
    expect(result[0].fmv_low).toBe(70)
    expect(result[0].organization_id).toBe(ORG)
  })

  it('sorts deterministically by category then name regardless of DB order', async () => {
    const supabase = makeSupabase({
      global: [
        globalRow({ id: '1', code: 'Z', name: 'Zeta', category: 'regulatory' }),
        globalRow({ id: '2', code: 'A', name: 'Alpha', category: 'clinical' }),
        globalRow({ id: '3', code: 'B', name: 'Bravo', category: 'clinical' }),
        globalRow({ id: '4', code: 'F', name: 'Foxtrot', category: 'financial' }),
      ],
    })
    const result = await loadActivityCodeCatalog(supabase, ORG)
    expect(result.map((e) => `${e.category}:${e.name}`)).toEqual([
      'clinical:Alpha',
      'clinical:Bravo',
      'financial:Foxtrot',
      'regulatory:Zeta',
    ])
  })

  it('global query error → returns [] and records into unavailable', async () => {
    const unavailable: string[] = []
    const supabase = makeSupabase({ globalError: { message: 'rls denied' } })
    const result = await loadActivityCodeCatalog(supabase, ORG, unavailable)
    expect(result).toEqual([])
    expect(unavailable).toHaveLength(1)
    expect(unavailable[0]).toContain('rls denied')
  })

  it('org query error → returns [] and records into unavailable', async () => {
    const unavailable: string[] = []
    const supabase = makeSupabase({ global: [globalRow()], orgError: { message: 'timeout' } })
    const result = await loadActivityCodeCatalog(supabase, ORG, unavailable)
    expect(result).toEqual([])
    expect(unavailable[0]).toContain('timeout')
  })

  it('thrown exception → caught, returns [] and records into unavailable', async () => {
    const unavailable: string[] = []
    const supabase = makeSupabase({ throwOnFrom: true })
    const result = await loadActivityCodeCatalog(supabase, ORG, unavailable)
    expect(result).toEqual([])
    expect(unavailable[0]).toContain('connection refused')
  })

  it('degrades silently (no throw) when no unavailable collector is passed', async () => {
    const supabase = makeSupabase({ globalError: { message: 'boom' } })
    await expect(loadActivityCodeCatalog(supabase, ORG)).resolves.toEqual([])
  })
})
