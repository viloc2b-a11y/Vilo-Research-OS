import { NextRequest, NextResponse } from 'next/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadProtocolSetupModel } from '@/lib/studies/load-protocol-setup'
import {
  buildBudgetNegotiationExportMarkdown,
  loadStudyBudgetEvidenceSummary,
} from '@/lib/study-workspace/load-budget-evidence-summary'

type RouteContext = { params: Promise<{ studyId: string }> }

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { studyId } = await context.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: study } = await supabase
    .from('studies')
    .select('id, name, organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  const organizationId = String(study.organization_id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const protocolSetup = await loadProtocolSetupModel({
      studyId,
      organizationId,
    })
    const summary = await loadStudyBudgetEvidenceSummary(
      studyId,
      organizationId,
      protocolSetup,
      supabase,
    )
    const exportMarkdown = buildBudgetNegotiationExportMarkdown({
      studyName: String(study.name ?? 'Study'),
      studyId,
      organizationId,
      generatedAt: new Date().toISOString(),
      summary,
      protocolSetup,
    })
    const filename = `budget-negotiation-${slugify(String(study.name ?? 'study'))}-${new Date()
      .toISOString()
      .slice(0, 10)}.md`

    return new NextResponse(exportMarkdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export budget negotiation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
