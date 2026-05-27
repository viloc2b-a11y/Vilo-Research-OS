import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  OPERATIONAL_SIGNATURE_WARNING,
  OperationalSignatureStateError,
  signOperationalArtifact,
} from '@/lib/operational-signatures'
import { authorizeOperationalSignatureWrite } from '@/lib/operational-signatures/operational-signature-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  let body: {
    organization_id?: string
    explicit_user_action?: boolean
    confirmation_statement?: string
    artifact_snapshot?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }
  if (!body.explicit_user_action || body.confirmation_statement !== OPERATIONAL_SIGNATURE_WARNING) {
    return NextResponse.json({ error: 'Explicit signature confirmation is required' }, { status: 400 })
  }

  const auth = await authorizeOperationalSignatureWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent')

  try {
    const signature = await signOperationalArtifact(supabase, {
      requestId: id,
      signerUserId: auth.userId,
      signerMemberships: auth.memberships,
      explicitUserAction: body.explicit_user_action,
      confirmationStatement: body.confirmation_statement,
      artifactSnapshot: body.artifact_snapshot,
      ipAddress,
      userAgent,
      metadata: body.metadata,
    })
    return NextResponse.json({ ok: true, signature })
  } catch (error) {
    if (error instanceof OperationalSignatureStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to sign artifact'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
