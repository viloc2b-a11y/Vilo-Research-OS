import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CaptureForm } from '@/components/source/capture-form'
import { ManifestSummaryPanel } from '@/components/source/manifest-summary-panel'
import { ReadPanelErrorCard } from '@/components/source/read-panel-error'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { loadCaptureShell } from '@/lib/source/capture/load-capture-shell'

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
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Source capture</h1>
        <ReadPanelErrorCard error={loaded.error} />
      </div>
    )
  }

  const model = loaded.model
  const { context } = model

  return (
    <div className="space-y-6">
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

      <CaptureForm model={model} />
    </div>
  )
}
