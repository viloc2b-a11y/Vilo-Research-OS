'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { DocumentIntelligenceSearchResult } from '@/lib/document-intelligence/document-intelligence-types'

type StudyOption = { id: string; name: string }

export function StudyCopilotClient({
  organizationId,
  studies,
  initialStudyId = null,
  initialQuery = '',
}: {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
  initialQuery?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<DocumentIntelligenceSearchResult[]>([])

  const studyIds = useMemo(() => new Set(studies.map((study) => study.id)), [studies])

  const resolveStudyFromUrl = useCallback((): string => {
    const fromQuery = searchParams.get('study_id') ?? initialStudyId ?? ''
    if (fromQuery && studyIds.has(fromQuery)) return fromQuery
    return ''
  }, [initialStudyId, searchParams, studyIds])

  const resolvedStudyId = useMemo(() => resolveStudyFromUrl(), [resolveStudyFromUrl])
  const studyId = resolvedStudyId
  const hasActiveQuery = Boolean(query.trim())

  const onStudyChange = useCallback(
    (nextStudyId: string) => {
      setResults([])
      setQuery('')
      const params = new URLSearchParams(searchParams.toString())
      if (nextStudyId) {
        params.set('study_id', nextStudyId)
      } else {
        params.delete('study_id')
      }
      params.delete('q')
      const newQuery = params.toString()
      router.replace(newQuery ? `/document-intelligence?${newQuery}` : '/document-intelligence', {
        scroll: false,
      })
    },
    [router, searchParams],
  )

  const handleSearch = async (searchQuery: string = query) => {
    const nextQuery = searchQuery.trim()
    if (!nextQuery || !studyId) return
    setQuery(nextQuery)
    const params = new URLSearchParams(searchParams.toString())
    params.set('study_id', studyId)
    params.set('q', nextQuery)
    router.replace(`/document-intelligence?${params.toString()}`, { scroll: false })
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/document-intelligence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          query: nextQuery,
          limit: 8,
        }),
      })
      const data = (await res.json()) as {
        results?: DocumentIntelligenceSearchResult[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const suggestedQuestionGroups = [
    {
      label: 'Execution',
      questions: [
        'What procedures are required at Visit 4?',
        'What is the visit window for V7?',
        'Is metformin allowed?',
        'When should an SAE be reported?',
        'Which procedures require PI signature?',
      ],
    },
    {
      label: 'Budget / CTA',
      questions: [
        'Which procedures appear invoiceable or reimbursable?',
        'What payment terms or invoice due dates are mentioned?',
        'Which pass-through costs are described?',
        'Are screen failure payments or reimbursements described?',
        'What budget items should be reviewed before negotiation?',
      ],
    },
  ]

  const backHref = studyId ? `/studies/${studyId}/workspace` : '/document-center'
  const backLabel = studyId ? 'Back to Study Workspace' : 'Back to Document Center'

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="mb-4 flex flex-col space-y-4">
        <Link 
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href={backHref} className="hover:text-slate-800 hover:underline">
            {studyId ? 'Study Workspace' : 'Document Center'}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-slate-800">Study Copilot</span>
        </div>
      </div>

      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Study Assistant
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Study Copilot</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ask questions about the protocol, lab manuals, operational guidelines, budget, or CTA.
        </p>
      </header>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Select Study
          <select
            className="mt-2 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
            value={studyId}
            onChange={(e) => onStudyChange(e.target.value)}
          >
            <option value="">Select a study…</option>
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Filter status
          </span>
          {hasActiveQuery ? (
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
              Active: {query}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              No active filter
            </span>
          )}
        </div>
        {hasActiveQuery ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              const params = new URLSearchParams(searchParams.toString())
              params.delete('q')
              params.set('study_id', studyId)
              router.replace(`/document-intelligence?${params.toString()}`, { scroll: false })
              setResults([])
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear filter
          </button>
        ) : null}
      </div>

      {!studyId ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">Select a study above to start asking questions.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">Ask a question about this study...</h2>
            
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                placeholder="e.g., What are the inclusion criteria for hemoglobin?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSearch()
                }}
              />
              <button
                className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
              >
                {loading ? 'Thinking...' : 'Ask'}
              </button>
            </div>

            {results.length === 0 && !loading && !error && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Suggested Questions
                </p>
                <div className="mt-3 space-y-4">
                  {suggestedQuestionGroups.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-medium text-slate-600">{group.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.questions.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleSearch(q)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-500">Relevant Source Information</h3>
              <ul className="space-y-4">
                {results.map((result) => (
                  <li key={result.chunkId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900">{result.sourceFilename}</h4>
                        <p className="text-xs font-medium text-teal-700">
                          {result.sectionTitle ? `Section: ${result.sectionTitle}` : 'General Information'}
                          {result.pageNumber != null ? ` · Page ${result.pageNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-md bg-slate-50 p-3">
                      <p className="text-sm text-slate-700 leading-relaxed">{result.snippet}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
