import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileSearch,
  FileUp,
  FolderKanban,
  GitPullRequest,
  GraduationCap,
  PackageCheck,
  Route,
  SearchCheck,
  Shield,
  Stethoscope,
} from 'lucide-react'
import { RecentDocumentRuntimeEvents } from '@/components/document-intake/recent-document-runtime-events'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder, canManageSourceDocuments } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function withStudy(path: string, studyId: string | null): string {
  if (!studyId) return path
  const params = new URLSearchParams({ study_id: studyId })
  return `${path}?${params.toString()}`
}

type DocumentCenterPageProps = {
  searchParams?: Promise<{ study_id?: string | string[] }>
}

type StudyOption = {
  id: string
  name: string
}

type HubCard = {
  title: string
  description: string
  href: string
  label: string
  icon: React.ElementType
  disabled?: boolean
  note?: string
}

type DestinationCard = {
  title: string
  description: string
  href: string
  icon: React.ElementType
  enabled: boolean
  actionLabel: string
  note?: string
}

function HubCardView({ card }: { card: HubCard }) {
  const Icon = card.icon
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50">
          <Icon className="h-5 w-5 text-teal-700" />
        </div>
        {card.disabled ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Permission needed
          </span>
        ) : null}
      </div>
      <h2 className="mt-4 text-sm font-semibold text-slate-900">{card.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{card.description}</p>
      {card.note ? <p className="mt-2 text-xs text-slate-500">{card.note}</p> : null}
      <span className="vilo-hover-reveal mt-4 inline-flex text-xs font-semibold text-teal-700">
        {card.label}
      </span>
    </>
  )

  if (card.disabled) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 opacity-75">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={card.href}
      className="rounded-md border border-slate-200 bg-white p-5 transition-colors hover:border-teal-200 hover:bg-slate-50"
    >
      {body}
    </Link>
  )
}

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
            Select an existing study before routing protocol, source, finance, regulatory, or
            compliance documents. Study creation stays in Studies.
          </p>
        </div>
        {selectedStudyId ? (
          <Link
            href={`/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=study-setup`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Open study routing
          </Link>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/studies"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-200 hover:text-teal-800"
        >
          Go To Studies
        </Link>
        {studies.slice(0, 8).map((study) => {
          const active = study.id === selectedStudyId
          return (
            <Link
              key={study.id}
              href={`/document-center?study_id=${encodeURIComponent(study.id)}`}
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

function DestinationCardView({ destination }: { destination: DestinationCard }) {
  const Icon = destination.icon
  const body = (
    <>
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100">
        <Icon className="h-4 w-4 text-slate-700" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{destination.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{destination.description}</p>
      {destination.note ? <p className="mt-2 text-xs text-slate-500">{destination.note}</p> : null}
      <span className="vilo-hover-reveal mt-3 inline-flex text-xs font-semibold text-teal-700">
        {destination.actionLabel}
      </span>
    </>
  )

  if (!destination.enabled) {
    return <div className="rounded-md border border-slate-200 bg-slate-50 p-4 opacity-75">{body}</div>
  }

  return (
    <Link
      href={destination.href}
      className="rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-teal-200 hover:bg-slate-50"
    >
      {body}
    </Link>
  )
}

export default async function DocumentCenterPage({ searchParams }: DocumentCenterPageProps) {
  const params = (await searchParams) ?? {}
  const requestedStudyId = firstParam(params.study_id)

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document Center</h1>
        <p className="text-sm text-slate-500">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceDocuments(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document Center</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const canUseSourceWorkflow = canManageSourceBuilder(memberships, organizationId)
  const supabase = await createServerClient()
  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  const studyList: StudyOption[] = (studies ?? []).map((study) => ({
    id: String(study.id),
    name: String(study.name),
  }))
  const selectedStudyId =
    requestedStudyId && studyList.some((study) => study.id === requestedStudyId)
      ? requestedStudyId
      : null

  const uploadHref = withStudy('/document-intake', selectedStudyId)
  const intelligenceHref = withStudy('/document-intelligence', selectedStudyId)
  const studyRoutingHref = selectedStudyId
    ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=study-setup`
    : '/studies'
  const studyWorkspaceHref = selectedStudyId
    ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace`
    : '/studies'
  const uploadWithStudyHref = withStudy('/document-intake', selectedStudyId)

  const cards: HubCard[] = [
    {
      title: 'Upload Documents',
      description: 'Register protocols, amendments, regulatory files, source evidence, finance documents, and supporting study records.',
      href: uploadWithStudyHref,
      label: 'Open upload',
      icon: FileUp,
    },
    {
      title: 'Recent Documents',
      description: 'Review recent uploads, certified-copy status, expiration dates, and compliance audit activity.',
      href: uploadHref,
      label: 'View recent uploads',
      icon: FileSearch,
    },
    {
      title: 'Needs Review',
      description: 'Ingest uploaded documents for study-scoped search and review extracted evidence before operational use.',
      href: intelligenceHref,
      label: 'Open review',
      icon: SearchCheck,
    },
    {
      title: 'Ready For Reconciliation',
      description: 'Continue from approved protocol extraction into visit and procedure reconciliation.',
      href: withStudy('/protocol-reconciliation', selectedStudyId),
      label: 'Open reconciliation',
      icon: GitPullRequest,
      disabled: !canUseSourceWorkflow,
      note: canUseSourceWorkflow ? undefined : 'Requires source setup permission.',
    },
    {
      title: 'Ready For Source Generation',
      description: 'Generate study source from approved reconciliation when protocol setup is ready.',
      href: withStudy('/protocol-runtime-generation', selectedStudyId),
      label: 'Generate source',
      icon: PackageCheck,
      disabled: !canUseSourceWorkflow,
      note: canUseSourceWorkflow ? undefined : 'Requires source setup permission.',
    },
    {
      title: 'Generated Assets',
      description: 'Open generated source packages and continue to coordinator-ready source review.',
      href: withStudy('/runtime-source-packages', selectedStudyId),
      label: 'Open generated assets',
      icon: CheckCircle2,
      disabled: !canUseSourceWorkflow,
      note: canUseSourceWorkflow ? undefined : 'Requires source setup permission.',
    },
    {
      title: 'Study Setup Routing',
      description: 'Route protocol, regulatory, source, pharmacy, finance, and evidence documents from the study workspace.',
      href: studyRoutingHref,
      label: selectedStudyId ? 'Open study routing' : 'Select a study',
      icon: Route,
    },
    {
      title: 'Study Workspaces',
      description: 'Open a study to continue document routing, source setup, binder review, visit execution, and compliance work.',
      href: '/studies',
      label: 'Open studies',
      icon: FolderKanban,
    },
  ]

  const destinations: DestinationCard[] = [
    {
      title: 'Regulatory',
      description: 'Route regulatory documents and inspection-ready records to the study binder.',
      href: selectedStudyId
        ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=regulatory-binder`
        : '/studies',
      icon: Shield,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Open Regulatory Binder' : 'Select Study',
    },
    {
      title: 'Source',
      description: 'Continue source setup inside the selected study. No global Source Builder handoff.',
      href: selectedStudyId
        ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=source-runtime`
        : '/studies',
      icon: FileSearch,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Open Study Source' : 'Select Study',
    },
    {
      title: 'Subjects',
      description: 'Route subject-level records to the study subject workspace.',
      href: selectedStudyId
        ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=subjects`
        : '/studies',
      icon: Stethoscope,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Open Subjects' : 'Select Study',
    },
    {
      title: 'Financial',
      description: 'Upload finance documents with budget/contract classification for study-scoped review.',
      href: uploadWithStudyHref,
      icon: DollarSign,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Upload Finance Document' : 'Select Study',
      note: 'Dedicated financial workspace is still planned.',
    },
    {
      title: 'Training',
      description: 'Route training materials to the selected study training context.',
      href: selectedStudyId
        ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=training`
        : '/studies',
      icon: GraduationCap,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Open Training' : 'Select Study',
    },
    {
      title: 'Documents',
      description: 'Manage uploaded study documents, recent intake, and document intelligence handoff.',
      href: selectedStudyId
        ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=documents`
        : '/studies',
      icon: ClipboardList,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Open Documents' : 'Select Study',
    },
    {
      title: 'Compliance',
      description: 'Review obligations, expiration alerts, and compliance document status.',
      href: selectedStudyId
        ? `/studies/${encodeURIComponent(selectedStudyId)}/workspace?section=documents`
        : '/studies',
      icon: CheckCircle2,
      enabled: Boolean(selectedStudyId),
      actionLabel: selectedStudyId ? 'Open Compliance' : 'Select Study',
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Document orchestration</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Document Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload documents, review extracted evidence, route study documents, and continue into
          reconciliation and coordinator-ready source generation. Existing intake, intelligence,
          reconciliation, and source generation workflows remain unchanged.
        </p>
      </header>

      <StudyContextBar studies={studyList} selectedStudyId={selectedStudyId} />

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Document routing destinations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose an existing study, then route documents to the correct operational area inside
              that study. Document Center does not create studies.
            </p>
          </div>
          <Link
            href={studyWorkspaceHref}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {selectedStudyId ? 'Open Study Workspace' : 'Go To Studies'}
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {destinations.map((destination) => (
            <DestinationCardView key={destination.title} destination={destination} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <HubCardView key={card.title} card={card} />
        ))}
      </section>

      <RecentDocumentRuntimeEvents
        organizationId={organizationId}
        studyId={selectedStudyId}
      />
    </div>
  )
}
