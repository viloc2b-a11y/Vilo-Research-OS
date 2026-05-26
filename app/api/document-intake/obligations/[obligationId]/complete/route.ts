import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntake } from '@/lib/document-intake/document-intake-auth'
import { completeComplianceObligation } from '@/lib/document-intake/complete-obligation'

type RouteContext = { params: Promise<{ obligationId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { obligationId } = await context.params

  let body: { organization_id?: string; completion_meaning?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  const completionMeaning = body.completion_meaning?.trim()

  if (!organizationId || !completionMeaning) {
    return NextResponse.json(
      { error: 'organization_id and completion_meaning are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const obligation = await completeComplianceObligation({
      supabase,
      organizationId,
      obligationId,
      completedBy: auth.userId,
      completionMeaning,
    })
    return NextResponse.json({ ok: true, obligation })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete obligation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
