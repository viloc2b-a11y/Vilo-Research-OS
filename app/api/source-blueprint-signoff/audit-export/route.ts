import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { createSourceBlueprintAuditExport } from '@/lib/source-blueprint-signoff/create-audit-export'

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    study_id?: string
    signoff_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.signoff_id) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and signoff_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const auditExport = await createSourceBlueprintAuditExport(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      signoffId: body.signoff_id,
      generatedBy: auth.userId,
    })
    return NextResponse.json({ ok: true, auditExport })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create audit export'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
