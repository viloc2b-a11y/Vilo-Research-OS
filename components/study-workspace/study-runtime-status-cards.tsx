import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudyWorkspaceSummaryCounts } from '@/lib/study-workspace/study-workspace-types'

type StudyRuntimeStatusCardsProps = {
  counts: StudyWorkspaceSummaryCounts
  links: StudyWorkspaceRuntimeLinks
}

function formatCount(value: number | null): string {
  if (value === null) return '—'
  return String(value)
}

type CardDef = {
  label: string
  value: number | null
  href: string
  detail: string
}

export function StudyRuntimeStatusCards({ counts, links }: StudyRuntimeStatusCardsProps) {
  const cards: CardDef[] = [
    {
      label: 'Subjects',
      value: counts.subjectCount,
      href: links.studySubjects,
      detail: 'Enrolled participants',
    },
    {
      label: 'Binder documents',
      value: counts.documentCount,
      href: links.documentIntake,
      detail: 'Compliance runtime documents',
    },
    {
      label: 'Published source',
      value: counts.publishedSourceCount,
      href: links.publishedSource,
      detail: 'Active published versions',
    },
    {
      label: 'Runtime visits',
      value: counts.runtimeVisitCount,
      href: links.sourcePackages,
      detail: 'Compiled study runtime visits',
    },
    {
      label: 'Locked snapshots',
      value: counts.lockedSnapshotCount,
      href: links.visitRuntime,
      detail: 'Immutable visit snapshots',
    },
    {
      label: 'Open obligations',
      value: counts.openObligationsCount,
      href: links.documentIntake,
      detail: 'Signatures & acknowledgements',
    },
    {
      label: 'Expiration alerts',
      value: counts.expirationAlertsCount,
      href: links.documentIntake,
      detail: 'Pending document expirations',
    },
    {
      label: 'Document Intelligence',
      value: null,
      href: links.documentIntelligence,
      detail: 'Study-scoped document search & evidence',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="group rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(card.value)}</p>
          <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
          <span className="vilo-hover-reveal mt-2 inline-block text-xs font-medium text-teal-700">
            Open module →
          </span>
        </Link>
      ))}
    </div>
  )
}
