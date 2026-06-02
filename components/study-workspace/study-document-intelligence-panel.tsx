import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type StudyDocumentIntelligencePanelProps = {
  links: StudyWorkspaceRuntimeLinks
}

export function StudyDocumentIntelligencePanel({ links }: StudyDocumentIntelligencePanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Study Copilot</h2>
      <p className="mt-2 text-sm text-slate-600">
        Ask questions about the protocol, lab manuals, or operational guidelines.
      </p>
      <Link
        href={links.documentIntelligence}
        className="mt-4 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open Study Copilot
      </Link>
    </section>
  )
}
