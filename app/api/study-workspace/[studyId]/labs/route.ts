import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  loadStudyLabResults,
  type StudyLabFilterParams,
} from '@/lib/longitudinal-labs/load-study-lab-results'

type RouteContext = { params: Promise<{ studyId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { studyId } = await context.params

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerClient()
  const { data: study } = await supabase
    .from('studies')
    .select('organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) {
    return NextResponse.json({ error: 'Study not found' }, { status: 404 })
  }

  const organizationId = String(study.organization_id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filters: StudyLabFilterParams = {}

  const search = searchParams.get('search')
  if (search) filters.search = search

  const subjectId = searchParams.get('subjectId')
  if (subjectId) filters.subjectId = subjectId

  const visitId = searchParams.get('visitId')
  if (visitId) filters.visitId = visitId

  const labTestCode = searchParams.get('labTestCode')
  if (labTestCode) filters.labTestCode = labTestCode

  const labCategory = searchParams.get('labCategory')
  if (labCategory) filters.labCategory = labCategory

  const dateFrom = searchParams.get('dateFrom')
  if (dateFrom) filters.dateFrom = dateFrom

  const dateTo = searchParams.get('dateTo')
  if (dateTo) filters.dateTo = dateTo

  const signalKinds = searchParams.getAll('signalKind')
  if (signalKinds.length > 0) filters.signalKinds = signalKinds

  const limit = searchParams.get('limit')
  if (limit) filters.limit = Math.min(Number(limit), 1000)

  const offset = searchParams.get('offset')
  if (offset) filters.offset = Number(offset)

  try {
    const result = await loadStudyLabResults(
      supabase,
      studyId,
      organizationId,
      filters,
    )
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load study lab results'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
