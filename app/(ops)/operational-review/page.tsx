import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canAccessSubjectVisitWorkspace } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { OperationalReviewClient } from '@/components/operational-review/operational-review-client'

const OPERATIONAL_REVIEW_SUBJECT_OPTION_LIMIT = 100
const OPERATIONAL_REVIEW_LOCKED_SNAPSHOT_LIMIT = 100
const OPERATIONAL_REVIEW_STUDY_LIMIT = 100

export default async function OperationalReviewPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Operational review</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessSubjectVisitWorkspace(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Operational review</h1>
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
    .limit(OPERATIONAL_REVIEW_STUDY_LIMIT)

  const studyList = (studies ?? []).map((study) => ({
    id: String(study.id),
    name: String(study.name),
  }))

  const subjectsByStudy: Record<string, { id: string; subjectIdentifier: string }[]> = {}
  const snapshotsByStudy: Record<
    string,
    {
      id: string
      visitCode: string
      visitName: string
      snapshotHash: string
      studyId: string
      subjectId: string
    }[]
  > = {}

  for (const study of studyList) {
    const { data: subjects } = await supabase
      .from('study_subjects')
      .select('id, subject_identifier')
      .eq('organization_id', organizationId)
      .eq('study_id', study.id)
      .order('subject_identifier', { ascending: true })
      .limit(OPERATIONAL_REVIEW_SUBJECT_OPTION_LIMIT)

    subjectsByStudy[study.id] = (subjects ?? []).map((subject) => ({
      id: String(subject.id),
      subjectIdentifier: String(subject.subject_identifier),
    }))

    const { data: snapshots } = await supabase
      .from('visit_runtime_snapshots')
      .select('id, study_id, subject_id, snapshot_hash, snapshot_json')
      .eq('organization_id', organizationId)
      .eq('study_id', study.id)
      .eq('snapshot_status', 'locked')
      .order('locked_at', { ascending: false })
      .limit(OPERATIONAL_REVIEW_LOCKED_SNAPSHOT_LIMIT)

    snapshotsByStudy[study.id] = (snapshots ?? []).map((snapshot) => {
      const json = snapshot.snapshot_json as {
        visit_instance?: { visit_code?: string; visit_name?: string }
      }
      return {
        id: String(snapshot.id),
        studyId: String(snapshot.study_id),
        subjectId: String(snapshot.subject_id),
        snapshotHash: String(snapshot.snapshot_hash),
        visitCode: String(json.visit_instance?.visit_code ?? 'Visit'),
        visitName: String(json.visit_instance?.visit_name ?? 'Unknown'),
      }
    })
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Operational review</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review locked visit snapshots, open field-level queries, and resolve them before
          marking review complete. Internal operational workflow only.
        </p>
      </header>
      <OperationalReviewClient
        organizationId={organizationId}
        studies={studyList}
        subjectsByStudy={subjectsByStudy}
        snapshotsByStudy={snapshotsByStudy}
      />
    </div>
  )
}
