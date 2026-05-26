import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolIntakeRead, authorizeProtocolIntakeWrite } from '@/lib/protocol-intake-runtime/protocol-intake-auth'
import { createProtocolRuntimeStudy } from '@/lib/protocol-intake-runtime/create-protocol-runtime-study'
import { listProtocolRuntimeStudies } from '@/lib/protocol-intake-runtime/list-protocol-runtime-studies'
import type { CreateProtocolRuntimeStudyInput } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolIntakeRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const studies = await listProtocolRuntimeStudies(supabase, organizationId)
    return NextResponse.json({ ok: true, studies })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list protocol runtime studies'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: CreateProtocolRuntimeStudyInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.protocol_number || !body.protocol_title) {
    return NextResponse.json(
      { error: 'organization_id, protocol_number, and protocol_title are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeProtocolIntakeWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const study = await createProtocolRuntimeStudy({ supabase, input: body, createdBy: auth.userId })
    return NextResponse.json({ ok: true, study })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create protocol runtime study'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

