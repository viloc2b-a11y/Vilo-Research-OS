import Link from 'next/link'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudyWorkspaceSubjectPreview } from '@/lib/study-workspace/study-workspace-types'

type StudySubjectsPanelProps = {
  studyId: string
  links: StudyWorkspaceRuntimeLinks
  subjects: StudyWorkspaceSubjectPreview[]
  subjectCount: number | null
}

export function StudySubjectsPanel({
  studyId,
  links,
  subjects,
  subjectCount,
}: StudySubjectsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Subjects</h2>
          <p className="mt-1 text-sm text-slate-500">
            Open subject workspaces for visit execution and chart review.
            {subjectCount !== null ? ` ${subjectCount} subject(s) on study.` : ''}
          </p>
        </div>
        <Link
          href={links.studySubjects}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          View all subjects
        </Link>
      </div>

      {subjects.length === 0 ? (
        <p className="text-sm text-slate-500">No subjects found for this study.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
          {subjects.map((subject) => (
            <li key={subject.id} className="group flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{subject.subjectIdentifier}</p>
                <p className="text-xs text-slate-500">
                  {subject.enrollmentStatus ?? 'Enrollment status unavailable'}
                </p>
              </div>
              <Link
                href={`/subjects/${subject.id}/workspace`}
                className="vilo-hover-reveal rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Subject workspace
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">
        Study context: <span className="font-mono">{studyId}</span>
      </p>
    </div>
  )
}
