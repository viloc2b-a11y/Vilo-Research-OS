'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, Pill } from 'lucide-react'
import type { StudySubjectRosterRow } from '@/lib/study-workspace/load-study-subject-roster'

type StudySubjectRosterViewProps = {
  studyId: string
  subjects: StudySubjectRosterRow[]
  searchQuery: string
}

export function StudySubjectRosterView({
  studyId,
  subjects,
  searchQuery,
}: StudySubjectRosterViewProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const hasActiveFilter = Boolean(searchQuery.trim())

  function updateSearchQuery(value: string) {
    const params = new URLSearchParams(currentSearchParams.toString())
    if (value.trim()) params.set('subject_q', value.trim())
    else params.delete('subject_q')
    router.replace(`/studies/${studyId}/workspace?${params.toString()}`, { scroll: false })
  }

  if (subjects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">Study Subject Roster</h2>
          <p className="text-sm text-slate-500">
            Initial server-limited subject roster, highlighting safety and schedule compliance.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                {searchQuery ? 'No subjects match this search' : 'No subjects enrolled'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchQuery
                  ? 'Try a different subject identifier or clear the filter.'
                  : 'Subjects will appear in the operational roster once enrolled in the study.'}
              </p>
            </div>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => updateSearchQuery('')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear search
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Study Subject Roster</h2>
        <p className="text-sm text-slate-500">
          Initial server-limited subject roster, highlighting safety and schedule compliance.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Filter status
          </span>
          {hasActiveFilter ? (
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
              Active: {searchQuery}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              No active filter
            </span>
          )}
        </div>
        {hasActiveFilter ? (
          <button
            type="button"
            onClick={() => updateSearchQuery('')}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear filter
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm text-slate-600">
          {searchQuery ? (
            <span>
              Showing matches for <span className="font-medium text-slate-900">{searchQuery}</span>
            </span>
          ) : (
            <span>Use search to narrow the roster before loading more subjects.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
            placeholder="Search subject ID"
            className="h-9 w-[220px] rounded-md border border-slate-300 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => updateSearchQuery('')}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 pl-4 pr-3 font-medium">Subject</th>
                <th className="px-3 py-3 font-medium">Enrollment Status</th>
                <th className="px-3 py-3 font-medium">Current Visit</th>
                <th className="px-3 py-3 font-medium">Next Visit</th>
                <th className="px-3 py-3 font-medium text-center">Overdue Visits</th>
                <th className="px-3 py-3 font-medium text-center">Coordinator</th>
                <th className="px-3 py-3 font-medium text-center">Active AEs</th>
                <th className="px-3 py-3 font-medium text-center">Active ConMeds</th>
                <th className="px-3 py-3 font-medium">Last Activity</th>
                <th className="px-3 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((sub) => (
                <tr key={sub.subjectId} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-3 font-medium text-slate-900">
                    <Link href={sub.hrefSubject} className="hover:underline">
                      {sub.subjectIdentifier}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="capitalize text-slate-700">
                      {sub.enrollmentStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {sub.currentVisitName ? (
                      <span className="font-medium text-teal-700">{sub.currentVisitName}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {sub.nextVisitName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {sub.overdueVisitCount > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                        {sub.overdueVisitCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-slate-400 italic">Unassigned</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {sub.activeAeCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                        <Activity className="h-3.5 w-3.5" />
                        {sub.activeAeCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {sub.activeConMedCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-blue-700">
                        <Pill className="h-3.5 w-3.5" />
                        {sub.activeConMedCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {sub.lastActivityDate ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={sub.hrefSubject}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        title="Open Subject"
                      >
                        Open
                      </Link>
                      <span className="text-slate-300">|</span>
                      <Link
                        href={`${sub.hrefSubject}?tab=aes`}
                        className="text-xs font-medium text-amber-700 hover:text-amber-800"
                        title="Review AEs"
                      >
                        AEs
                      </Link>
                      <span className="text-slate-300">|</span>
                      <Link
                        href={`${sub.hrefSubject}?tab=conmeds`}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800"
                        title="Review ConMeds"
                      >
                        ConMeds
                      </Link>
                      <span className="text-slate-300">|</span>
                      <Link
                        href={`${sub.hrefSubject}?tab=documents`}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        title="Review Consent"
                      >
                        Consent
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
