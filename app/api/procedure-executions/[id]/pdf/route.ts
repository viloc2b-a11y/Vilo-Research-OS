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

  const def = Array.isArray(ctx.procedure.procedure_definitions)
    ? ctx.procedure.procedure_definitions[0]
    : ctx.procedure.procedure_definitions
  const isUnblinded = Boolean(def?.is_unblinded)

  if (isUnblinded) {
    const { canViewUnblindedData } = await import('@/lib/rbac/permissions')
    const { getOrganizationMemberships } = await import('@/lib/auth/session')
    const memberships = await getOrganizationMemberships(ctx.user.id)
    if (!canViewUnblindedData(memberships, ctx.procedure.organization_id)) {
      return NextResponse.json({ error: 'Your role cannot export unblinded source records.' }, { status: 403 })
    }
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
