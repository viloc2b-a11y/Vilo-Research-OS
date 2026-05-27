import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudyWorkspaceSummaryCounts } from '@/lib/study-workspace/study-workspace-types'

type StudyRegulatoryBinderPanelProps = {
  links: StudyWorkspaceRuntimeLinks
  counts: Pick<
    StudyWorkspaceSummaryCounts,
    'documentCount' | 'openObligationsCount' | 'expirationAlertsCount'
  >
}

export function StudyRegulatoryBinderPanel({ links, counts }: StudyRegulatoryBinderPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Regulatory Binder</h2>
        <p className="mt-1 text-sm text-slate-500">
          Site regulatory binder powered by document intake, compliance obligations, and expiration
          monitoring. Documents uploaded through compliance runtime are indexed here at study scope.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Documents in binder</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {counts.documentCount ?? '—'}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Open obligations</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {counts.openObligationsCount ?? '—'}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Expiration alerts</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {counts.expirationAlertsCount ?? '—'}
          </p>
        </div>
      </div>

      <Link
        href={links.documentIntake}
        className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open document intake & compliance
      </Link>
    </div>
  )
}
