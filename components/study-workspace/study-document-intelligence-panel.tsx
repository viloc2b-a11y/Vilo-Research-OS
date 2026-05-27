import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type StudyDocumentIntelligencePanelProps = {
  links: StudyWorkspaceRuntimeLinks
}

export function StudyDocumentIntelligencePanel({ links }: StudyDocumentIntelligencePanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Document Intelligence</h2>
      <p className="mt-2 text-sm text-slate-600">
        Search and review study documents used to support protocol intake, source design, budget
        review, and operational guidance.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Follows{' '}
        <Link href={links.documentIntake} className="font-medium text-teal-700 hover:underline">
          Document Intake
        </Link>{' '}
        — documents must be uploaded before ingest here.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
        <li>Select this study (preselected when opened from workspace)</li>
        <li>Ingest uploaded compliance documents for search</li>
        <li>Search study-scoped knowledge chunks</li>
        <li>Review referenced source chunks before operational use</li>
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Evidence lookup only — results must be reviewed; this does not replace approved runtime
        truth.
      </p>
      <Link
        href={links.documentIntelligence}
        className="mt-4 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open Document Intelligence
      </Link>
    </section>
  )
}
