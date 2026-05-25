import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ManifestSummaryPanel } from '@/components/source/manifest-summary-panel'
import { ReadPanelErrorCard } from '@/components/source/read-panel-error'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { CoordinatorSafeErrorPanel } from '@/components/runtime-ui/CoordinatorSafeErrorPanel'
import { coordinatorMessageFromError } from '@/lib/runtime-errors/coordinator-facing'
import { VisitRuntimeShell } from '@/components/subjects/visits/VisitRuntimeShell'
import { VisitWorkflowPanel } from '@/components/subjects/workflow/VisitWorkflowPanel'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { loadCaptureShell } from '@/lib/source/capture/load-capture-shell'
import { loadVisitRuntimeToolbar } from '@/lib/subject/visit-runtime/data'
import { loadContextWorkflowActions } from '@/lib/subject/workflow/data'
import { loadSubjectVisitSchedule } from '@/lib/visits/loadSubjectVisitSchedule'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PageProps = {
  params: Promise<{ procedureExecutionId: string }>
  searchParams: Promise<{ organization_id?: string }>
}

export default async function SourceCapturePage({ params, searchParams }: PageProps) {
  const { procedureExecutionId } = await params
  const sp = await searchParams

  if (!UUID_RE.test(procedureExecutionId)) {
    notFound()
  }

  const user = await getSessionUser()
  if (!user) {
    notFound()
  }

  let organizationId = sp.organization_id?.trim() ?? ''
  if (!UUID_RE.test(organizationId)) {
    const memberships = await getOrganizationMemberships(user.id)
    organizationId = memberships[0]?.organization_id ?? ''
  }

  const loaded = await loadCaptureShell(procedureExecutionId, organizationId || undefined)

  if (loaded.status === 'error') {
    return (
      <CoordinatorPageScroll contentClassName="p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">Source capture</h1>
          <CoordinatorSafeErrorPanel
            title="Source capture unavailable"
            detail={loaded.error.messages[0] ?? 'This capture session could not be loaded.'}
            retryHref={`/source/capture/${procedureExecutionId}`}
            backHref="/command-center"
            backLabel="Command center"
          />
          <ReadPanelErrorCard error={loaded.error} />
        </div>
      </CoordinatorPageScroll>
    )
  }

  const model = loaded.model
  const { context } = model
  const toolbar = await loadVisitRuntimeToolbar(model)
  const schedule = await loadSubjectVisitSchedule({
    studySubjectId: context.studySubjectId,
    studyId: context.studyId,
    currentVisitId: context.visitId,
    organizationId: context.organizationId,
  })
  const workflowResult = await loadContextWorkflowActions({
    organizationId: context.organizationId,
    visitId: context.visitId,
    procedureExecutionId: context.procedureExecutionId,
    sourceResponseSetId: model.responseSetId,
  })

  return (
    <CoordinatorPageScroll contentClassName="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/studies" className="hover:underline">
            Studies
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <Link href={context.studyPath} className="hover:underline">
            {context.studyName}
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <Link href={context.subjectPath} className="hover:underline">
            {context.subjectLabel}
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <Link href={context.visitPath} className="hover:underline">
            {context.visitLabel}
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <span className="text-foreground">Capture</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{context.procedureLabel}</h1>
        <p className="text-sm text-muted-foreground">
          CRC capture shell — writes via internal APIs only; values refresh from canonical read
          contracts after each action.
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{model.statusLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Opened</dt>
            <dd className="font-medium">{model.openedAtDisplay ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Submitted</dt>
            <dd className="font-medium">{model.submittedAtDisplay ?? '—'}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Response set{' '}
          <span className="font-mono">{model.responseSetId.slice(0, 8)}…</span>
          {' · '}
          <Link href={model.reviewHref} className="hover:underline">
            Open source review
          </Link>
        </p>
      </div>

      {model.manifest ? <ManifestSummaryPanel model={model.manifest} /> : null}

      <VisitRuntimeShell model={model} toolbar={toolbar} scheduleVisits={schedule.visits} />
      {workflowResult.ok ? (
        <VisitWorkflowPanel
          organizationId={context.organizationId}
          studyId={context.studyId}
          subjectId={context.studySubjectId}
          visitId={context.visitId}
          procedureExecutionId={context.procedureExecutionId}
          sourceResponseSetId={model.responseSetId}
          sourceSectionKey="source-form"
          actions={workflowResult.actions}
        />
      ) : (
        <CoordinatorSafeErrorPanel
          title="Procedure workflow unavailable"
          detail={coordinatorMessageFromError(new Error(workflowResult.error), {
            context: 'source-capture-workflow',
          })}
          retryHref={`/source/capture/${procedureExecutionId}`}
          backHref={context.visitPath}
          backLabel="Back to visit"
        />
      )}
      </div>
    </CoordinatorPageScroll>
  )
}
