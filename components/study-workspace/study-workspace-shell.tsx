'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildStudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudySetupDocument } from '@/lib/study-workspace/load-study-setup-documents'
import type {
  StudyWorkspaceSectionId,
  StudyWorkspaceSubjectPreview,
  StudyWorkspaceSummary,
} from '@/lib/study-workspace/study-workspace-types'
import { StudyActivityFeed } from './study-activity-feed'
import { StudyDelegationPanel } from './study-delegation-panel'
import { StudyMonitoringViewPanel } from './study-monitoring-view-panel'
import { StudyRegulatoryBinderView } from './study-regulatory-binder-view'
import { StudyDocumentsView } from './study-documents-view'
import { StudyVisitMatrixView } from './study-visit-matrix-view'
import { StudySetupPanel } from './study-setup-panel'
import { StudySourcePanel } from './study-source-panel'
import { StudySubjectRosterView } from './study-subject-roster-view'
import { StudyTrainingPanel } from './study-training-panel'
import { StudyCommandCenterView } from './study-command-center-view'
import { STUDY_WORKSPACE_NAV_ITEMS, StudyWorkspaceNav } from './study-workspace-nav'

const VALID_SECTIONS = new Set<string>(STUDY_WORKSPACE_NAV_ITEMS.map((item) => item.id))

function parseSection(value: string | null): StudyWorkspaceSectionId {
  if (value && VALID_SECTIONS.has(value)) return value as StudyWorkspaceSectionId
  return 'overview'
}

import type { ComplianceRuntimeDocument } from '@/lib/document-intake/compliance-types'
import type { StudyVisitRow } from '@/lib/visits/loadStudyVisits'
import type { StudySubjectRosterRow } from '@/lib/study-workspace/load-study-subject-roster'
import type { StudyCommandCenterMetrics } from '@/lib/study-workspace/load-study-command-center-metrics'

type StudyWorkspaceShellProps = {
  summary: StudyWorkspaceSummary
  subjects: StudySubjectRosterRow[]
  setupDocuments: StudySetupDocument[]
  hasProtocolDraft: boolean
  regulatoryDocuments: ComplianceRuntimeDocument[]
  studyDocuments: ComplianceRuntimeDocument[]
  visits: StudyVisitRow[]
  commandCenterMetrics: StudyCommandCenterMetrics
}

export function StudyWorkspaceShell({
  summary,
  subjects,
  setupDocuments,
  hasProtocolDraft,
  regulatoryDocuments,
  studyDocuments,
  visits,
  commandCenterMetrics,
}: StudyWorkspaceShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSection = parseSection(searchParams.get('section'))
  const [activeSection, setActiveSection] = useState<StudyWorkspaceSectionId>(initialSection)

  const links = useMemo(
    () => buildStudyWorkspaceRuntimeLinks(summary.study.id),
    [summary.study.id],
  )

  const onSelectSection = useCallback(
    (section: StudyWorkspaceSectionId) => {
      setActiveSection(section)
      const params = new URLSearchParams(searchParams.toString())
      params.set('section', section)
      router.replace(`/studies/${summary.study.id}/workspace?${params.toString()}`, {
        scroll: false,
      })
    },
    [router, searchParams, summary.study.id],
  )

  return (
    <div className="min-h-0 space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/studies" className="hover:text-slate-700 hover:underline">
              Studies
            </Link>
            <span>/</span>
            <span className="text-slate-400">{summary.study.name}</span>
            <span>/</span>
            <span className="text-slate-400">Workspace</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{summary.study.name}</h1>
          {summary.study.status ? (
            <p className="mt-1 text-sm text-slate-500">Status: {summary.study.status}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/document-intelligence?study_id=${summary.study.id}`}
            className="text-sm font-medium text-teal-700 hover:underline flex items-center gap-1.5"
          >
            Study Copilot
          </Link>
          <Link
            href={links.studyDetail}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Study detail
          </Link>
        </div>
      </header>

      <StudyWorkspaceNav activeSection={activeSection} onSelect={onSelectSection} />

      <div className="min-h-[320px] rounded-md border border-slate-200 bg-white p-5">
        {activeSection === 'overview' ? (
          <StudyCommandCenterView
            studyName={summary.study.name}
            studyStatus={summary.study.status}
            links={links}
            metrics={commandCenterMetrics}
          />
        ) : null}

        {activeSection === 'study-setup' ? (
          <StudySetupPanel
            documents={setupDocuments}
            links={links}
            studyId={summary.study.id}
            hasProtocolDraft={hasProtocolDraft}
            hasPublishedSource={(summary.counts.publishedSourceCount ?? 0) > 0}
          />
        ) : null}

        {activeSection === 'subjects' ? (
          <StudySubjectRosterView subjects={subjects} />
        ) : null}

        {activeSection === 'source-runtime' ? <StudySourcePanel links={links} /> : null}

        {activeSection === 'published-source' ? (
          <PublishedSourceSection links={links} count={summary.counts.publishedSourceCount} />
        ) : null}

        {activeSection === 'visit-runtime' ? (
          <StudyVisitMatrixView visits={visits} />
        ) : null}

        {activeSection === 'regulatory-binder' ? (
          <StudyRegulatoryBinderView links={links} documents={regulatoryDocuments} />
        ) : null}

        {activeSection === 'training' ? (
          <StudyTrainingPanel links={links} studyId={summary.study.id} />
        ) : null}

        {activeSection === 'delegation' ? (
          <StudyDelegationPanel links={links} studyId={summary.study.id} />
        ) : null}

        {activeSection === 'documents' ? (
          <StudyDocumentsView links={links} documents={studyDocuments} />
        ) : null}

        {activeSection === 'monitoring' ? (
          <StudyMonitoringViewPanel counts={summary.counts} />
        ) : null}

        {activeSection === 'activity' ? <StudyActivityFeed studyId={summary.study.id} /> : null}
      </div>
    </div>
  )
}

function PublishedSourceSection({
  links,
  count,
}: {
  links: ReturnType<typeof buildStudyWorkspaceRuntimeLinks>
  count: number | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Published Source</h2>
        <p className="mt-1 text-sm text-slate-500">
          Versioned published source packages used as the execution truth for visit workspaces.
          {count !== null ? ` ${count} published version(s).` : ''}
        </p>
      </div>
      <Link
        href={links.publishedSource}
        className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open published source module
      </Link>
    </div>
  )
}


