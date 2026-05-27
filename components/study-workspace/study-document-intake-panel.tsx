import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type StudyDocumentIntakePanelProps = {
  links: StudyWorkspaceRuntimeLinks
}

export function StudyDocumentIntakePanel({ links }: StudyDocumentIntakePanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Document Intake</h2>
      <p className="mt-2 text-sm text-slate-600">
        Upload or register study documents before intelligence processing.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Upstream of Document Intelligence — register compliance documents here first, then ingest them
        for search and evidence review. Upload only; no automatic intelligence indexing.
      </p>
      <Link
        href={links.documentIntake}
        className="mt-4 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open Document Intake
      </Link>
    </section>
  )
}
