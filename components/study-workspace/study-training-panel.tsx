import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type StudyTrainingPanelProps = {
  links: StudyWorkspaceRuntimeLinks
}

export function StudyTrainingPanel({ links }: StudyTrainingPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Training</h2>
        <p className="mt-1 text-sm text-slate-500">
          Placeholder for study-specific training attestations linked to regulatory binder workflows.
          Training records will attach to site staff and protocol amendments — not implemented in this
          shell.
        </p>
      </div>
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        <p className="font-medium text-slate-700">Coming soon</p>
        <p className="mt-2">
          Future workflows will connect training completion to delegation eligibility and binder
          evidence. For now, use{' '}
          <a href={links.documentIntake} className="text-teal-700 underline">
            Documents / Compliance
          </a>{' '}
          for uploaded training certificates.
        </p>
      </div>
    </div>
  )
}
