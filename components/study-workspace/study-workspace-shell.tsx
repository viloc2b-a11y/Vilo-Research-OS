'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildStudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type {
  StudyWorkspaceSectionId,
  StudyWorkspaceSubjectPreview,
  StudyWorkspaceSummary,
} from '@/lib/study-workspace/study-workspace-types'
import { StudyActivityFeed } from './study-activity-feed'
import { StudyDelegationPanel } from './study-delegation-panel'
import { StudyMonitoringViewPanel } from './study-monitoring-view-panel'
import { StudyOverviewPanel } from './study-overview-panel'
import { StudyRegulatoryBinderPanel } from './study-regulatory-binder-panel'
import { StudyRuntimeStatusCards } from './study-runtime-status-cards'
import { StudySourcePanel } from './study-source-panel'
import { StudySubjectsPanel } from './study-subjects-panel'
import { StudyTrainingPanel } from './study-training-panel'
import { StudyDocumentIntelligencePanel } from './study-document-intelligence-panel'
import { STUDY_WORKSPACE_NAV_ITEMS, StudyWorkspaceNav } from './study-workspace-nav'

const VALID_SECTIONS = new Set<string>(STUDY_WORKSPACE_NAV_ITEMS.map((item) => item.id))

function parseSection(value: string | null): StudyWorkspaceSectionId {
  if (value && VALID_SECTIONS.has(value)) return value as StudyWorkspaceSectionId
  return 'overview'
}

type StudyWorkspaceShellProps = {
  summary: StudyWorkspaceSummary
  subjects: StudyWorkspaceSubjectPreview[]
}

export function StudyWorkspaceShell({ summary, subjects }: StudyWorkspaceShellProps) {
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
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Study Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{summary.study.name}</h1>
          {summary.study.status ? (
            <p className="mt-1 text-sm text-slate-500">Status: {summary.study.status}</p>
          ) : null}
        </div>
        <Link
          href={links.studyDetail}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          Study detail
        </Link>
      </header>

      <StudyWorkspaceNav activeSection={activeSection} onSelect={onSelectSection} />

      <div className="min-h-[320px] rounded-md border border-slate-200 bg-white p-5">
        {activeSection === 'overview' ? (
          <div className="space-y-8">
            <StudyOverviewPanel
              studyName={summary.study.name}
              studyStatus={summary.study.status}
              links={links}
              unavailable={summary.unavailable}
            />
            <StudyRuntimeStatusCards counts={summary.counts} links={links} />
            <StudyDocumentIntelligencePanel links={links} />
          </div>
        ) : null}

        {activeSection === 'subjects' ? (
          <StudySubjectsPanel
            studyId={summary.study.id}
            links={links}
            subjects={subjects}
            subjectCount={summary.counts.subjectCount}
          />
        ) : null}

        {activeSection === 'source-runtime' ? <StudySourcePanel links={links} /> : null}

        {activeSection === 'published-source' ? (
          <PublishedSourceSection links={links} count={summary.counts.publishedSourceCount} />
        ) : null}

        {activeSection === 'visit-runtime' ? (
          <VisitRuntimeSection links={links} lockedCount={summary.counts.lockedSnapshotCount} />
        ) : null}

        {activeSection === 'regulatory-binder' ? (
          <StudyRegulatoryBinderPanel links={links} counts={summary.counts} />
        ) : null}

        {activeSection === 'training' ? <StudyTrainingPanel links={links} /> : null}

        {activeSection === 'delegation' ? <StudyDelegationPanel links={links} /> : null}

        {activeSection === 'documents' ? (
          <DocumentsComplianceSection links={links} counts={summary.counts} />
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

function VisitRuntimeSection({
  links,
  lockedCount,
}: {
  links: ReturnType<typeof buildStudyWorkspaceRuntimeLinks>
  lockedCount: number | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Visit Execution</h2>
        <p className="mt-1 text-sm text-slate-500">
          Subject visit workspaces, procedure capture, locking, and immutable snapshots.
          {lockedCount !== null ? ` ${lockedCount} locked snapshot(s) on study.` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={links.visitRuntime}
          className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open visit runtime
        </Link>
        <Link
          href={links.operationalReview}
          className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Operational review
        </Link>
      </div>
    </div>
  )
}

function DocumentsComplianceSection({
  links,
  counts,
}: {
  links: ReturnType<typeof buildStudyWorkspaceRuntimeLinks>
  counts: StudyWorkspaceSummary['counts']
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Documents / Compliance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Document intake, obligations, expiration alerts, and compliance runtime audit trail.
        </p>
      </div>
      <StudyRegulatoryBinderPanel links={links} counts={counts} />
      <StudyDocumentIntelligencePanel links={links} />
      <Link
        href={links.documentIntake}
        className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        Open document intake
      </Link>
    </div>
  )
}
