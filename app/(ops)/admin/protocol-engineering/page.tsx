import Link from 'next/link'
import {
  FileText,
  FileSearch,
  GitMerge,
  Workflow,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'

export default function ProtocolEngineeringPage() {
  const tools = [
    {
      id: 'document-intelligence',
      title: 'Document Intelligence',
      description: 'Manage study indexing, embeddings, and technical ingestion pipelines.',
      href: '/admin/protocol-engineering/document-intelligence',
      icon: FileSearch,
    },
    {
      id: 'source-builder',
      title: 'Source Builder',
      description: 'Design visit structures, forms, and validation logic templates.',
      href: '/source-builder',
      icon: FileText,
    },
    {
      id: 'reconciliation',
      title: 'Protocol Reconciliation',
      description: 'Align source data with the protocol truth and identify deviations.',
      href: '/protocol-reconciliation',
      icon: GitMerge,
    },
    {
      id: 'runtime-generation',
      title: 'Runtime Generation',
      description: 'Compile the blueprint into the executable runtime configuration.',
      href: '/protocol-runtime-generation',
      icon: Workflow,
    },
    {
      id: 'extraction-review',
      title: 'Extraction Review',
      description: 'Review and approve AI-extracted protocol constraints and windows.',
      href: '/protocol-intake-runtime',
      icon: CheckCircle,
    },
  ]

  return (
    <div className="vilo-ops-scroll flex h-full min-h-0 flex-col overflow-y-auto bg-accent scrollbar-thin">
      <div className="border-b border-border bg-card px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="heading-serif text-xl text-foreground">Protocol Engineering</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Technical tooling for protocol extraction, runtime generation, and document intelligence.
          </p>
        </div>
        <Link href="/admin" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin
        </Link>
      </div>
      
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="vilo-card-interactive block p-5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'rgba(52, 160, 144, 0.12)' }}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{tool.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
