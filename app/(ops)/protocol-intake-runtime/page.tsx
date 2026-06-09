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
      {initialSourceDocumentId ? (
        <div className="rounded-md border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-900">
          <p className="font-medium">Document Intelligence handoff detected</p>
          <p className="mt-1 text-teal-800">
            The selected source document is already preloaded for this session. Create or select a
            protocol runtime study, then use this source document to create the next protocol version
            in the canonical runtime pipeline.
          </p>
          <p className="mt-2 font-mono text-xs text-teal-700">
            source_document_id: {initialSourceDocumentId}
          </p>
        </div>
      ) : null}
      <ProtocolIntakeRuntimeClient
        organizationId={organizationId}
        initialStudyId={initialStudyId}
        initialSourceDocumentId={initialSourceDocumentId}
      />
    </div>
  )
}

