import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

const SPINE_STEPS = [
  { label: 'Document Intake', hrefKey: 'documentIntake' as const },
  { label: 'Document Intelligence', hrefKey: 'documentIntelligence' as const },
  { label: 'Source Evidence Review', hrefKey: 'sourceBlueprintEvidence' as const },
  { label: 'Draft Suggestions', hrefKey: 'sourceBlueprintDrafting' as const },
  { label: 'Signoff & Audit', hrefKey: 'sourceBlueprintSignoff' as const },
  { label: 'Runtime Source', hrefKey: 'sourcePackages' as const },
  { label: 'Visit Execution', hrefKey: 'visitRuntime' as const },
]

type StudyOverviewPanelProps = {
  studyName: string
  studyStatus: string | null
  links: StudyWorkspaceRuntimeLinks
  unavailable: string[]
}

export function StudyOverviewPanel({
  studyName,
  studyStatus,
  links,
  unavailable,
}: StudyOverviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Study Workspace</h2>
        <p className="mt-2 text-sm text-slate-600">
          Operational hub for <span className="font-medium text-slate-900">{studyName}</span>
          {studyStatus ? (
            <span className="text-slate-500"> · {studyStatus}</span>
          ) : null}
          . This workspace orchestrates the clinical runtime spine — navigation only, with execution
          handled in dedicated modules.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-5">
        <h3 className="text-sm font-semibold text-slate-800">Evidence runtime spine</h3>
        <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {SPINE_STEPS.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2">
              <Link
                href={links[step.hrefKey]}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition-colors hover:border-teal-200 hover:bg-white hover:text-teal-800"
              >
                {step.label}
              </Link>
              {index < SPINE_STEPS.length - 1 ? (
                <span className="text-slate-400" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {unavailable.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some summary counts are unavailable: {unavailable.join(' · ')}
        </div>
      ) : null}
    </div>
  )
}
