import { NextResponse } from 'next/server'
import { resolveProcedureContext } from '@/lib/visit-runtime/context'
import { generateProcedurePdf } from '@/lib/visit-runtime/generateProcedurePdf'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const url = new URL(request.url)
  const organizationId = url.searchParams.get('organization_id')
  const ctx = await resolveProcedureContext(id, organizationId)

  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: 404 })
  }

  const result = await generateProcedurePdf({
    supabase: ctx.supabase,
    procedureExecutionId: ctx.procedure.id,
    organizationId: ctx.procedure.organization_id,
    actorUserId: ctx.user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return new Response(result.bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
    },
  })
}
