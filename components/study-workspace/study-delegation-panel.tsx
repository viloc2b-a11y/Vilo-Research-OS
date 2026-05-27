import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type StudyDelegationPanelProps = {
  links: StudyWorkspaceRuntimeLinks
}

export function StudyDelegationPanel({ links }: StudyDelegationPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Delegation Log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Placeholder for the study delegation of authority log. Delegation entries will reference
          regulatory binder documents and staff training — not implemented in this shell.
        </p>
      </div>
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        <p className="font-medium text-slate-700">Coming soon</p>
        <p className="mt-2">
          Delegation log UI will list authorized procedures per role with effective dates. Coordinate
          evidence via the{' '}
          <a href={links.documentIntake} className="text-teal-700 underline">
            Documents / Compliance
          </a>{' '}
          until delegation workflows ship.
        </p>
      </div>
    </div>
  )
}
