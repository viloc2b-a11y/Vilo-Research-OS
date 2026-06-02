import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { StudyCopilotClient } from '@/components/document-intelligence/study-copilot-client'

type DocumentIntelligencePageProps = {
  searchParams: Promise<{ study_id?: string }>
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
}: {
  initialStudyId: string | null
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Study Copilot</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceDocuments(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Study Copilot</h1>
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
    <StudyCopilotClient
      organizationId={organizationId}
      studies={studyList}
      initialStudyId={validInitialStudyId}
    />
  )
}

export default async function DocumentIntelligencePage({
  searchParams,
}: DocumentIntelligencePageProps) {
  const params = await searchParams
  const initialStudyId = params.study_id?.trim() || null

  return (
    <Suspense fallback={<DocumentIntelligenceLoading />}>
      <DocumentIntelligenceContent initialStudyId={initialStudyId} />
    </Suspense>
  )
}
