import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DocumentIntakeClient } from './document-intake-client'

type DocumentIntakePageProps = {
  searchParams: Promise<{ study_id?: string }>
}

function DocumentIntakeLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
      <div className="h-32 animate-pulse rounded-md bg-slate-100" />
    </div>
  )
}

async function DocumentIntakeContent({ queryStudyId }: { queryStudyId: string | null }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Document intake</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceDocuments(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Document intake</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  let initialStudyId: string | null = null
  if (queryStudyId) {
    const supabase = await createServerClient()
    const { data: study } = await supabase
      .from('studies')
      .select('id')
      .eq('id', queryStudyId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (study) initialStudyId = String(study.id)
  }

  return (
    <DocumentIntakeClient organizationId={organizationId} initialStudyId={initialStudyId} />
  )
}

export default async function DocumentIntakePage({ searchParams }: DocumentIntakePageProps) {
  const params = await searchParams
  const queryStudyId = params.study_id?.trim() || null

  return (
    <Suspense fallback={<DocumentIntakeLoading />}>
      <DocumentIntakeContent queryStudyId={queryStudyId} />
    </Suspense>
  )
}
