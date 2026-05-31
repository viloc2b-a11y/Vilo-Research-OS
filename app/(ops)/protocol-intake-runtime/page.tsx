import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { ProtocolIntakeRuntimeClient } from '@/components/protocol-intake-runtime/protocol-intake-runtime-client'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type ProtocolIntakeRuntimePageProps = {
  searchParams?: Promise<{ study_id?: string | string[]; source_document_id?: string | string[] }>
}

export default async function ProtocolIntakeRuntimePage({
  searchParams,
}: ProtocolIntakeRuntimePageProps) {
  const params = (await searchParams) ?? {}
  const initialStudyId = firstParam(params.study_id)
  const initialSourceDocumentId = firstParam(params.source_document_id)

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Protocol intake runtime</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Protocol intake runtime</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Protocol intake runtime
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload protocol versions via compliance document intake, then run lightweight extraction to
          produce structured sections and operational candidates for human reconciliation.
        </p>
      </header>
      <ProtocolIntakeRuntimeClient
        organizationId={organizationId}
        initialStudyId={initialStudyId}
        initialSourceDocumentId={initialSourceDocumentId}
      />
    </div>
  )
}

