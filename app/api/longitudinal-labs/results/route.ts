import { type NextRequest, NextResponse } from 'next/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { createServerClient } from '@/lib/supabase/server'
import {
  insertLabResults,
} from '@/lib/longitudinal-labs/insert-lab-results'
import type { InsertLabResultInput } from '@/lib/longitudinal-labs/longitudinal-lab-types'

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const parsed = body as Record<string, unknown>
    const results = parsed.results as unknown[] | undefined

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'results must be a non-empty array.' },
        { status: 400 },
      )
    }

    const first = results[0] as Record<string, unknown>
    if (
      typeof first.organizationId !== 'string' ||
      typeof first.studyId !== 'string' ||
      typeof first.subjectId !== 'string' ||
      typeof first.labTestCode !== 'string'
    ) {
      return NextResponse.json(
        {
          error:
            'Each result must have organizationId, studyId, subjectId, and labTestCode.',
        },
        { status: 400 },
      )
    }

    const auth = await requireActiveOrganizationAccess(
      first.organizationId as string,
    )
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: 401 })
    }

    const supabase = await createServerClient()
    const result = await insertLabResults({
      supabase,
      results: results as InsertLabResultInput[],
    })

    return NextResponse.json({
      inserted: result.inserted,
      signals: result.signals,
      count: result.inserted.length,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
