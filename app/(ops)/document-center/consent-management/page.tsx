import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ConsentManagementView } from '@/components/document-center/consent-management-view'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceDocuments } from '@/lib/rbac/permissions'
import { loadConsentManagementOverview } from '@/lib/document-center/load-consent-management'
import { createServerClient } from '@/lib/supabase/server'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type ConsentManagementPageProps = {
  searchParams?: Promise<{ study_id?: string | string[] }>
}

type StudyOption = {
  id: string
  name: string
}

const STUDY_SELECTOR_LIMIT = 100

function StudyContextBar({
  studies,
  selectedStudyId,
}: {
  studies: StudyOption[]
  selectedStudyId: string | null
}) {
  if (studies.length === 0) return null

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Study context</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select the study whose consent templates and subject consent records you want to manage.
          </p>
        </div>
        <Link
          href="/document-center"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Back to Document Center
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {studies.slice(0, 8).map((study) => {
          const active = study.id === selectedStudyId
          return (
            <Link
              key={study.id}
              href={`/document-center/consent-management?study_id=${encodeURIComponent(study.id)}`}
              className={
                active
                  ? 'rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-200 hover:text-teal-800'
              }
            >
              {study.name}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default async function ConsentManagementPage({ searchParams }: ConsentManagementPageProps) {
  const params = (await searchParams) ?? {}
  const requestedStudyId = firstParam(params.study_id)

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Consent Management</h1>
        <p className="text-sm text-slate-500">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceDocuments(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Consent Management</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const supabase = await createServerClient()
  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })
    .limit(STUDY_SELECTOR_LIMIT)

  const studyList: StudyOption[] = (studies ?? []).map((study) => ({
    id: String(study.id),
    name: String(study.name),
  }))

  const selectedStudyId =
    requestedStudyId && studyList.some((study) => study.id === requestedStudyId)
      ? requestedStudyId
      : null

  const overview = selectedStudyId
    ? await loadConsentManagementOverview(selectedStudyId, organizationId)
    : null

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Document center</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Consent Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage study-level consent templates, subject consent records, evidence uploads, and reconsent follow-up.
          Paper, electronic, and external-platform consent all land in the same operational record.
        </p>
      </header>

      <StudyContextBar studies={studyList} selectedStudyId={selectedStudyId} />

      {!selectedStudyId ? (
        <section className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
          Pick a study to open the consent library, subject consent records, evidence uploads, and reconsent queue.
        </section>
      ) : overview ? (
        <ConsentManagementView overview={overview} studyId={selectedStudyId} />
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Consent data could not be loaded for this study.
        </section>
      )}
    </div>
  )
}
