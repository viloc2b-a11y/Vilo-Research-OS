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
        Ask questions about the protocol, lab manuals, budget, CTA, or operational guidelines.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={links.documentIntelligence}
          className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open Study Copilot
        </Link>
        <Link
          href={links.documentIntelligence}
          className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Budget / CTA review
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Budget review uses study-scoped evidence from Document Intelligence. Financial Runtime
        remains the source of execution and revenue truth.
      </p>
    </section>
  )
}
