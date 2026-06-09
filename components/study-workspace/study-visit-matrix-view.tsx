'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'
import type { StudyVisitRow } from '@/lib/visits/loadStudyVisits'

type StudyVisitMatrixViewProps = {
  studyId: string
  visits: StudyVisitRow[]
  searchQuery: string
}

type MatrixRow = {
  visitCode: string
  visitName: string
  expected: number
  scheduled: number
  inProgress: number
  completed: number
  missed: number
  overdue: number
  subjects: StudyVisitRow[]
}

export function StudyVisitMatrixView({ studyId, visits, searchQuery }: StudyVisitMatrixViewProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set())
  const hasActiveFilter = Boolean(searchQuery.trim())

  function toggleCode(code: string) {
    setExpandedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function updateSearchQuery(value: string) {
    const params = new URLSearchParams(currentSearchParams.toString())
    if (value.trim()) params.set('visit_q', value.trim())
    else params.delete('visit_q')
    router.replace(`/studies/${studyId}/workspace?${params.toString()}`, { scroll: false })
    setExpandedCodes(new Set())
  }

  // Aggregate into matrix
  const matrixMap = new Map<string, MatrixRow>()

  for (const visit of visits) {
    const key = visit.visitCode
    if (!matrixMap.has(key)) {
      matrixMap.set(key, {
        visitCode: key,
        visitName: visit.visitName,
        expected: 0,
        scheduled: 0,
        inProgress: 0,
        completed: 0,
        missed: 0,
        overdue: 0,
        subjects: [],
      })
    }

    const row = matrixMap.get(key)!
    row.expected += 1
    row.subjects.push(visit)

    if (visit.visitStatus === 'completed' || visit.visitStatus === 'locked') {
      row.completed += 1
    } else if (visit.visitStatus === 'in_progress' || visit.visitStatus === 'checked_in') {
      row.inProgress += 1
    } else if (visit.visitStatus === 'missed') {
      row.missed += 1
    } else if (visit.group === 'overdue' || visit.visitStatus === 'out_of_window') {
      row.overdue += 1
    } else if (visit.scheduledDate) {
      row.scheduled += 1
    }
  }

  const matrix = Array.from(matrixMap.values())

  if (matrix.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">Study Visit Matrix</h2>
          <p className="text-sm text-slate-500">
            Visit execution tracking across all active subjects. Click a visit to drill down.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                {searchQuery ? 'No visits match this search' : 'No visits available'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchQuery
                  ? 'Try a different visit code, visit name, or subject identifier.'
                  : 'Enrolled subjects will appear in the visit matrix once execution schedules are generated.'}
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
        <h2 className="text-lg font-semibold text-slate-900">Study Visit Matrix</h2>
        <p className="text-sm text-slate-500">
          Visit execution tracking across all active subjects. Click a visit to drill down.
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
            <span>Use search to narrow the visit matrix before loading more records.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
            placeholder="Search visit or subject"
            className="h-9 w-[240px] rounded-md border border-slate-300 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                <th className="py-3 pl-4 pr-3 font-medium">Visit</th>
                <th className="px-3 py-3 font-medium text-center">Expected</th>
                <th className="px-3 py-3 font-medium text-center">Scheduled</th>
                <th className="px-3 py-3 font-medium text-center">In Progress</th>
                <th className="px-3 py-3 font-medium text-center">Completed</th>
                <th className="px-3 py-3 font-medium text-center">Missed</th>
                <th className="px-3 py-3 font-medium text-center">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrix.map((row) => {
                const isExpanded = expandedCodes.has(row.visitCode)
                return (
                  <Fragment key={row.visitCode}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => toggleCode(row.visitCode)}
                    >
                      <td className="py-3 pl-4 pr-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                          <div>
                            <div>{row.visitName}</div>
                            <div className="font-mono text-xs text-slate-500">{row.visitCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600">{row.expected}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{row.scheduled}</td>
                      <td className="px-3 py-3 text-center">
                        {row.inProgress > 0 ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {row.inProgress}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.completed > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {row.completed}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.missed > 0 ? (
                          <span className="text-slate-500">{row.missed}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.overdue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-rose-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {row.overdue}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/50 p-0">
                          <div className="border-b border-t border-slate-100 px-4 py-4">
                            <table className="w-full text-xs">
                              <thead className="text-slate-500">
                                <tr>
                                  <th className="pb-2 font-medium text-left">Subject</th>
                                  <th className="pb-2 font-medium text-left">Date</th>
                                  <th className="pb-2 font-medium text-left">Status</th>
                                  <th className="pb-2 font-medium text-left">Window</th>
                                  <th className="pb-2 font-medium text-left">Progress</th>
                                  <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {row.subjects.map((sub) => (
                                  <tr key={sub.visitId} className="group hover:bg-white transition-colors">
                                    <td className="py-2.5 font-medium text-slate-900">
                                      {sub.subjectIdentifier}
                                    </td>
                                    <td className="py-2.5 text-slate-600">
                                      {sub.scheduledDate ? sub.scheduledDate : (
                                        <span className="text-slate-400 italic">Unscheduled</span>
                                      )}
                                    </td>
                                    <td className="py-2.5">
                                      <span className="capitalize text-slate-700">
                                        {sub.visitStatus.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="py-2.5">
                                      <span className="capitalize text-slate-700">
                                        {sub.windowStatus.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                                          <div
                                            className="h-full bg-teal-500"
                                            style={{
                                              width: sub.totalProcedures > 0 
                                                ? `${Math.round((sub.completedProcedures / sub.totalProcedures) * 100)}%`
                                                : '0%'
                                            }}
                                          />
                                        </div>
                                        <span className="text-slate-500 text-xs">
                                          {sub.completedProcedures} / {sub.totalProcedures} procedures complete
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex justify-end gap-2">
                                        <Link
                                          href={sub.hrefSubject}
                                          className="text-slate-500 hover:text-slate-900"
                                        >
                                          Subject
                                        </Link>
                                        <span className="text-slate-300">|</span>
                                        <Link
                                          href={sub.hrefVisit}
                                          className="font-medium text-teal-700 hover:text-teal-800"
                                        >
                                          Visit
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
