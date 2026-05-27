import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { ScheduleMatrixReview } from '@/components/protocol-intake/schedule-matrix-review'
import type { DocumentExtractionRun } from '@/lib/protocol-intake/types'

type DocumentExtractionDraftPayload = Partial<DocumentExtractionRun> & {
  type?: string
}

export default async function ScheduleReviewPage({
  params,
}: {
  params: Promise<{ draftId: string }>
}) {
  const { draftId } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) redirect('/')

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    redirect('/')
  }

  const supabase = await createServerClient()
  const { data: draft, error } = await supabase
    .from('source_builder_drafts')
    .select('draft_payload, draft_name, updated_at')
    .eq('draft_id', draftId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !draft) {
    return <div>Draft not found or you lack permission.</div>
  }

  const payload = draft.draft_payload as DocumentExtractionDraftPayload | null
  if (payload?.type !== 'document_extraction_run') {
    return <div>Invalid draft type. Expected document extraction.</div>
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review Schedule of Events</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {draft.draft_name}. Extracted {payload.schedule_matrix?.length || 0} intersections.
        </p>
      </header>
      <ScheduleMatrixReview 
        intersections={payload.schedule_matrix || []} 
        draftId={draftId} 
        organizationId={organizationId} 
      />
    </div>
  )
}
