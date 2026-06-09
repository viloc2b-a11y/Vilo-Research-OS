import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DocumentIntelligenceClient } from '@/components/document-intelligence/document-intelligence-client'

type DocumentIntelligencePageProps = {
  searchParams: Promise<{ study_id?: string; q?: string; domain?: string; history?: string }>
}

function DocumentIntelligenceLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-72 animate-pulse rounded bg-slate-100" />
      <div className="h-24 animate-pulse rounded-md bg-slate-100" />
      <div className="h-64 animate-pulse rounded-md bg-slate-100" />
    </div>
  )
}

async function DocumentIntelligenceContent({
  initialStudyId,
  initialQuery,
  initialSearchArea,
  initialIncludeSuperseded,
}: {
  initialStudyId: string | null
  initialQuery: string
  initialSearchArea: string
  initialIncludeSuperseded: boolean
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Document Intelligence</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceDocuments(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Document Intelligence</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  const supabase = await createServerClient()
  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  const studyList = (studies ?? []).map((study) => ({
    id: String(study.id),
    name: String(study.name),
  }))

  const validInitialStudyId =
    initialStudyId && studyList.some((study) => study.id === initialStudyId)
      ? initialStudyId
      : null

  return (
    <DocumentIntelligenceClient
      organizationId={organizationId}
      studies={studyList}
      initialStudyId={validInitialStudyId}
      initialQuery={initialQuery}
      initialSearchArea={initialSearchArea}
      initialIncludeSuperseded={initialIncludeSuperseded}
    />
  )
}

export default async function DocumentIntelligencePage({
  searchParams,
}: DocumentIntelligencePageProps) {
  const params = await searchParams
  const initialStudyId = params.study_id?.trim() || null
  const initialQuery = params.q?.trim() || ''
  const initialSearchArea = params.domain?.trim() || ''
  const initialIncludeSuperseded = params.history === '1' || params.history === 'true'

  return (
    <Suspense fallback={<DocumentIntelligenceLoading />}>
      <DocumentIntelligenceContent
        initialStudyId={initialStudyId}
        initialQuery={initialQuery}
        initialSearchArea={initialSearchArea}
        initialIncludeSuperseded={initialIncludeSuperseded}
      />
    </Suspense>
  )
}
