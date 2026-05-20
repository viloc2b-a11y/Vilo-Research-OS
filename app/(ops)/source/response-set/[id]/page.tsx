import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FindingsPanel } from '@/components/source/findings-panel'
import { HistoryTimeline } from '@/components/source/history-timeline'
import { ManifestSummaryPanel } from '@/components/source/manifest-summary-panel'
import { ReadPanelErrorCard } from '@/components/source/read-panel-error'
import { ResponseSetDetail } from '@/components/source/response-set-detail'
import { loadResponseSetReviewBundle } from '@/lib/source/read-contract/load-bundle'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  canEditClinicalSource,
  canManageSourceDocuments,
  canViewUnblindedData,
} from '@/lib/rbac/permissions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    organization_id?: string
    active_only?: string
    status?: string
    severity?: string
  }>
}

function parseActiveOnly(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export default async function ResponseSetReviewPage({ params, searchParams }: PageProps) {
  const { id: responseSetId } = await params
  const sp = await searchParams

  if (!UUID_RE.test(responseSetId)) {
    notFound()
  }

  const user = await getSessionUser()
  if (!user) {
    notFound()
  }

  let organizationId = sp.organization_id?.trim() ?? ''
  const memberships = await getOrganizationMemberships(user.id)

  if (!UUID_RE.test(organizationId)) {
    organizationId = memberships[0]?.organization_id ?? ''
  }

  if (!UUID_RE.test(organizationId)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Source review</h1>
        <p className="text-sm text-muted-foreground">
          Provide <code className="text-xs">?organization_id=</code> or ensure the user has an
          organization membership.
        </p>
      </div>
    )
  }

  const findingsFilters = {
    active_only: parseActiveOnly(sp.active_only),
    status: sp.status?.trim() || null,
    severity: sp.severity?.trim() || null,
  }

  const bundle = await loadResponseSetReviewBundle(responseSetId, organizationId, findingsFilters)

  const allowPostSubmitWrites =
    bundle.manifest.status === 'success' && bundle.manifest.data.isSubmitted

  const canMutateSource =
    canManageSourceDocuments(memberships, organizationId) ||
    canEditClinicalSource(memberships, organizationId)
  const canViewUnblinded = canViewUnblindedData(memberships, organizationId)
  const allowCorrections = allowPostSubmitWrites && canMutateSource
  const allowAddenda = allowPostSubmitWrites && canMutateSource

  const anyError =
    bundle.detail.status === 'error' ||
    bundle.manifest.status === 'error' ||
    bundle.history.status === 'error' ||
    bundle.findings.status === 'error'

  return (
    <div className="p-6">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/studies" className="hover:underline">
            Studies
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <span className="text-foreground">Source review</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Response set review</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {responseSetId} · org {organizationId.slice(0, 8)}…
        </p>
        <p className="text-sm text-muted-foreground">
          Normalized read contracts — post-submit corrections, addenda, and finding lifecycle
          actions via API (no client-side lineage reconstruction).
        </p>
        {canViewUnblinded ? (
          <p className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            Unblinded Access — Restricted
          </p>
        ) : null}
      </div>

      {anyError ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {bundle.detail.status === 'error' ? (
            <ReadPanelErrorCard error={bundle.detail.error} />
          ) : null}
          {bundle.manifest.status === 'error' ? (
            <ReadPanelErrorCard error={bundle.manifest.error} />
          ) : null}
          {bundle.history.status === 'error' ? (
            <ReadPanelErrorCard error={bundle.history.error} />
          ) : null}
          {bundle.findings.status === 'error' ? (
            <ReadPanelErrorCard error={bundle.findings.error} />
          ) : null}
        </div>
      ) : null}

      {bundle.manifest.status === 'success' ? (
        <ManifestSummaryPanel model={bundle.manifest.data} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {bundle.detail.status === 'success' ? (
            <ResponseSetDetail
              model={bundle.detail.data}
              organizationId={organizationId}
              responseSetId={responseSetId}
              allowCorrections={allowCorrections}
              allowAddenda={allowAddenda}
            />
          ) : null}
        </div>
        <div className="space-y-6">
          {bundle.history.status === 'success' ? (
            <HistoryTimeline model={bundle.history.data} />
          ) : null}
          {bundle.findings.status === 'success' ? (
            <FindingsPanel
              model={bundle.findings.data}
              organizationId={organizationId}
              responseSetId={responseSetId}
            />
          ) : null}
        </div>
        </div>
      </div>
    </div>
  )
}
