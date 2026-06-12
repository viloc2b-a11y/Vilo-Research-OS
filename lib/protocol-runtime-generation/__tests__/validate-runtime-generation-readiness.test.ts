import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateRuntimeGenerationReadiness } from '../validate-runtime-generation-readiness'

// Helper: creates a thenable query builder whose chain resolves to pre-configured responses.
// Supabase builders are thenable (have .then), and awaited directly for count queries,
// or via .maybeSingle() for single-row lookups.
function stubQuery(config: {
  single?: { data: unknown; error?: { message: string } | null }
  count?: { data: unknown; count?: number | null; error?: { message: string } | null }
}) {
  const thenFn = vi.fn((onFulfilled: (r: unknown) => void) => {
    const r = config.count ?? { data: null, count: 0, error: null }
    return Promise.resolve({ data: r.data, error: r.error ?? null, count: r.count ?? null }).then(onFulfilled)
  })

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: config.single?.data ?? null,
      error: config.single?.error ?? null,
    }),
    then: thenFn,
  }
}

function successVersion(studyId: string) {
  return { data: { id: 'vp-001', protocol_runtime_study_id: studyId }, error: null }
}

function successStudy(args: { id: string; orgId: string; studyId: string | null }) {
  return { data: { id: args.id, organization_id: args.orgId, study_id: args.studyId }, error: null }
}

function ok() {
  return { data: null, error: null, count: 0 }
}

interface ProcedureRow {
  matched_procedure_library_id: string
  matched_blueprint_version_id: string
}

function okWithProcedures(rows: ProcedureRow[]) {
  return { data: rows, error: null, count: rows.length }
}

function makeSupabase(overrides: {
  versionData?: { data: unknown; error?: { message: string } | null }
  studyData?: { data: unknown; error?: { message: string } | null }
  unresolvedVisits?: { data: unknown; count?: number; error?: { message: string } | null }
  unresolvedProcedures?: { data: unknown; count?: number; error?: { message: string } | null }
  approvedMissingBlueprint?: { data: unknown; count?: number; error?: { message: string } | null }
  approvedVisits?: { data: unknown; count?: number; error?: { message: string } | null }
  approvedProcedures?: { data: ProcedureRow[]; count?: number; error?: { message: string } | null }
}) {
  const fromMock = vi.fn()
  fromMock
    .mockImplementationOnce(() =>
      stubQuery({
        single: overrides.versionData ?? successVersion('prs-1'),
      }),
    )
    .mockImplementationOnce(() =>
      stubQuery({
        single: overrides.studyData ?? successStudy({ id: 'prs-1', orgId: 'org-1', studyId: 'study-1' }),
      }),
    )
    .mockImplementationOnce(() =>
      stubQuery({
        count: overrides.unresolvedVisits ?? ok(),
      }),
    )
    .mockImplementationOnce(() =>
      stubQuery({
        count: overrides.unresolvedProcedures ?? ok(),
      }),
    )
    .mockImplementationOnce(() =>
      stubQuery({
        count: overrides.approvedMissingBlueprint ?? ok(),
      }),
    )
    .mockImplementationOnce(() =>
      stubQuery({
        count: overrides.approvedVisits ?? ok(),
      }),
    )
    .mockImplementationOnce(() =>
      stubQuery({
        count: overrides.approvedProcedures ?? okWithProcedures([{ matched_procedure_library_id: 'lib-1', matched_blueprint_version_id: 'bp-1' }]),
      }),
    )

  return { from: fromMock }
}

describe('validateRuntimeGenerationReadiness', () => {
  it('blocks when protocol_runtime_versions returns no row', async () => {
    const supabase = makeSupabase({
      versionData: { data: null, error: null },
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('version_not_found')
  })

  it('blocks when org_id does not match', async () => {
    const supabase = makeSupabase({
      studyData: successStudy({ id: 'prs-1', orgId: 'org-other', studyId: 'study-1' }),
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('org_mismatch')
  })

  it('blocks when study_id is missing', async () => {
    const supabase = makeSupabase({
      studyData: successStudy({ id: 'prs-1', orgId: 'org-1', studyId: null }),
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'missing_study_id')).toBe(true)
  })

  it('blocks when there are unresolved visits', async () => {
    const supabase = makeSupabase({
      unresolvedVisits: { data: null, count: 3, error: null },
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'unresolved_visits')).toBe(true)
    expect(result.errors.find((e) => e.code === 'unresolved_visits')?.metadata).toEqual({
      unresolved_count: 3,
    })
  })

  it('blocks when there are unresolved procedures', async () => {
    const supabase = makeSupabase({
      unresolvedProcedures: { data: null, count: 2, error: null },
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'unresolved_procedures')).toBe(true)
  })

  it('blocks when approved procedures are missing blueprint', async () => {
    const supabase = makeSupabase({
      approvedMissingBlueprint: { data: null, count: 1, error: null },
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'approved_missing_blueprint')).toBe(true)
  })

  it('passes when all required records exist', async () => {
    const supabase = makeSupabase({
      approvedVisits: { data: null, count: 0, error: null },
      approvedProcedures: { data: [], count: 0, error: null },
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.summary.approved_visits).toBe(0)
    expect(result.summary.approved_procedures).toBe(0)
    expect(result.summary.distinct_mappings).toBe(0)
  })

  it('reports summary with counts and distinct mappings', async () => {
    const supabase = makeSupabase({
      approvedVisits: { data: null, count: 8, error: null },
      approvedProcedures: {
        data: [
          { matched_procedure_library_id: 'lib-1', matched_blueprint_version_id: 'bp-1' },
          { matched_procedure_library_id: 'lib-1', matched_blueprint_version_id: 'bp-1' },
          { matched_procedure_library_id: 'lib-2', matched_blueprint_version_id: 'bp-2' },
        ],
        count: 3,
        error: null,
      },
    }) as unknown as SupabaseClient

    const result = await validateRuntimeGenerationReadiness({
      supabase,
      organizationId: 'org-1',
      protocolVersionId: 'vp-001',
    })

    expect(result.summary.approved_visits).toBe(8)
    expect(result.summary.approved_procedures).toBe(3)
    expect(result.summary.distinct_mappings).toBe(2)
  })
})
