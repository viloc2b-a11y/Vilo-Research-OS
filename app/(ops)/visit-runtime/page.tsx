import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canAccessSubjectVisitWorkspace } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { VisitRuntimeClient } from '@/components/visit-runtime-execution/visit-runtime-client'
import { PUBLICATION_STATUS } from '@/lib/runtime-source-publication/runtime-source-publication-types'
import { resolveInitialVisitRuntimeStudy } from '@/lib/visit-runtime-execution/resolve-initial-visit-runtime-study'

type VisitRuntimePageProps = {
  searchParams: Promise<{ study_id?: string }>
}

const VISIT_RUNTIME_SUBJECT_OPTION_LIMIT = 100
const VISIT_RUNTIME_PUBLICATION_LIMIT = 5
const VISIT_RUNTIME_STUDY_LIMIT = 100

function VisitRuntimeLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-72 animate-pulse rounded bg-slate-100" />
      <div className="h-24 animate-pulse rounded-md bg-slate-100" />
    </div>
  )
}

async function VisitRuntimeContent({ queryStudyId }: { queryStudyId: string | null }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Visit runtime execution</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessSubjectVisitWorkspace(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Visit runtime execution</h1>
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
    .limit(VISIT_RUNTIME_STUDY_LIMIT)

  const studyList = (studies ?? []).map((study) => ({
    id: String(study.id),
    name: String(study.name),
  }))

  const { initialStudyId, invalidStudyIdFromQuery } = resolveInitialVisitRuntimeStudy({
    queryStudyId,
    accessibleStudyIds: studyList.map((study) => study.id),
  })

  type PublishedSourceInternal = {
    publicationId: string
    publicationVersion: number
    packageHash: string
    sourcePackageId: string
  }

  const subjectsByStudy: Record<string, { id: string; subjectIdentifier: string }[]> = {}
  const publishedSourcesByStudy: Record<string, PublishedSourceInternal[]> = {}
  const visitShellsByPublication: Record<string, { id: string; visitCode: string; visitName: string }[]> =
    {}
  const procedureFieldDefinitionsByShell: Record<
    string,
    Array<{ field_id: string; label: string; type: string; required?: boolean }>
  > = {}

  for (const study of studyList) {
    const { data: subjects } = await supabase
      .from('study_subjects')
      .select('id, subject_identifier')
      .eq('organization_id', organizationId)
      .eq('study_id', study.id)
      .order('subject_identifier', { ascending: true })
      .limit(VISIT_RUNTIME_SUBJECT_OPTION_LIMIT)

    subjectsByStudy[study.id] = (subjects ?? []).map((subject) => ({
      id: String(subject.id),
      subjectIdentifier: String(subject.subject_identifier),
    }))

    const { data: pubs } = await supabase
      .from('runtime_source_package_publications')
      .select('id, publication_version, publication_status, package_hash, source_package_id')
      .eq('organization_id', organizationId)
      .eq('study_id', study.id)
      .eq('publication_status', PUBLICATION_STATUS.PUBLISHED)
      .order('publication_version', { ascending: false })
      .limit(VISIT_RUNTIME_PUBLICATION_LIMIT)

    publishedSourcesByStudy[study.id] = (pubs ?? []).map((pub) => ({
      publicationId: String(pub.id),
      publicationVersion: Number(pub.publication_version),
      packageHash: String(pub.package_hash),
      sourcePackageId: String(pub.source_package_id),
    }))
  }

  const allPublishedSources = Object.values(publishedSourcesByStudy).flat()
  const sourcePackageIds = allPublishedSources.map((p) => p.sourcePackageId)

  if (sourcePackageIds.length > 0) {
    const { data: visitShells } = await supabase
      .from('runtime_source_visit_shells')
      .select('id, source_package_id, visit_code, visit_name, sequence_order')
      .in('source_package_id', sourcePackageIds)
      .order('sequence_order', { ascending: true })

    for (const shell of visitShells ?? []) {
      const packageId = String(shell.source_package_id)
      const matchingPublications = allPublishedSources.filter((p) => p.sourcePackageId === packageId)
      for (const pub of matchingPublications) {
        const publicationId = pub.publicationId
        if (!visitShellsByPublication[publicationId]) visitShellsByPublication[publicationId] = []
        visitShellsByPublication[publicationId].push({
          id: String(shell.id),
          visitCode: String(shell.visit_code),
          visitName: String(shell.visit_name),
        })
      }
    }

    const { data: procedureShells } = await supabase
      .from('runtime_source_procedure_shells')
      .select('id, source_shell_json')
      .in('source_package_id', sourcePackageIds)

    for (const shell of procedureShells ?? []) {
      const fields =
        ((shell.source_shell_json as { fields?: Array<{
          field_id: string
          label: string
          type: string
          required?: boolean
        }> })?.fields) ?? []
      procedureFieldDefinitionsByShell[String(shell.id)] = fields
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Visit runtime execution
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create subject visit workspaces from published source versions. Capture procedure field
          values, lock completed visits, and preserve immutable snapshots (execution uses published
          source truth — final eSource signatures not implemented here).
        </p>
      </header>
      <VisitRuntimeClient
        organizationId={organizationId}
        studies={studyList}
        initialStudyId={initialStudyId}
        invalidStudyIdFromQuery={invalidStudyIdFromQuery}
        subjectsByStudy={subjectsByStudy}
        publishedSourcesByStudy={Object.fromEntries(
          Object.entries(publishedSourcesByStudy).map(([studyId, pubs]) => [
            studyId,
            pubs.map((p) => ({
              publicationId: p.publicationId,
              publicationVersion: p.publicationVersion,
              packageHash: p.packageHash,
            })),
          ]),
        ) as Record<string, { publicationId: string; publicationVersion: number; packageHash: string }[]>}
        visitShellsByPublication={visitShellsByPublication}
        procedureFieldDefinitionsByShell={procedureFieldDefinitionsByShell}
      />
    </div>
  )
}

export default async function VisitRuntimePage({ searchParams }: VisitRuntimePageProps) {
  const params = await searchParams
  const queryStudyId = params.study_id?.trim() || null

  return (
    <Suspense fallback={<VisitRuntimeLoading />}>
      <VisitRuntimeContent queryStudyId={queryStudyId} />
    </Suspense>
  )
}
