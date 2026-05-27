import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type ModuleLink = {
  title: string
  description: string
  href: string
}

type StudySourcePanelProps = {
  links: StudyWorkspaceRuntimeLinks
}

export function StudySourcePanel({ links }: StudySourcePanelProps) {
  const modules: ModuleLink[] = [
    {
      title: 'Protocol Intake',
      description: 'Upload protocol versions and run supervised extraction into operational candidates.',
      href: links.protocolIntake,
    },
    {
      title: 'Reconciliation',
      description: 'Match visit and procedure candidates to library blueprints with human approval.',
      href: links.protocolReconciliation,
    },
    {
      title: 'Runtime Generation',
      description: 'Generate study runtime visits and procedures from approved reconciliation.',
      href: links.protocolRuntimeGeneration,
    },
    {
      title: 'Source Runtime (packages)',
      description: 'Review and approve source package drafts compiled from the runtime graph.',
      href: links.sourcePackages,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Source Runtime</h2>
        <p className="mt-1 text-sm text-slate-500">
          Design-time pipeline from protocol intake through source package approval. Each step links
          to an existing module; no duplicate engines here.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {modules.map((mod) => (
          <Link
            key={mod.title}
            href={mod.href}
            className="group rounded-md border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-sm font-medium text-slate-900">{mod.title}</p>
            <p className="mt-1 text-xs text-slate-500">{mod.description}</p>
            <span className="vilo-hover-reveal mt-2 inline-block text-xs font-medium text-teal-700">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
