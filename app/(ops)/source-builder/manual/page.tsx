import { loadProcedureLibrary } from '@/lib/source-builder/procedure-library'
import { SourceBuilderWorkspace } from '@/components/source-builder/source-builder-workspace'
import {
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'

type PageProps = {
  searchParams: Promise<{ draft?: string }>
}

export default async function SourceBuilderManualPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const library = loadProcedureLibrary()
  const user = await getSessionUser()
  const organizationId = user ? await getPrimaryOrganizationId(user.id) : null

  return (
    <SourceBuilderWorkspace
      library={library}
      initialDraftId={sp.draft ?? null}
      organizationId={organizationId}
    />
  )
}
