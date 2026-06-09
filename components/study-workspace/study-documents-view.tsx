'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FileText, Search, ExternalLink, Info, BrainCircuit } from 'lucide-react'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { ComplianceRuntimeDocument } from '@/lib/document-intake/compliance-types'

type StudyDocumentsViewProps = {
  studyId: string
  links: StudyWorkspaceRuntimeLinks
  documents: ComplianceRuntimeDocument[]
  searchQuery: string
}

export function StudyDocumentsView({ studyId, links, documents, searchQuery }: StudyDocumentsViewProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const hasActiveFilter = Boolean(searchQuery.trim())

  function updateSearchQuery(value: string) {
    const params = new URLSearchParams(currentSearchParams.toString())
    if (value.trim()) params.set('docs_q', value.trim())
    else params.delete('docs_q')
    router.replace(`/studies/${studyId}/workspace?${params.toString()}`, { scroll: false })
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Study Documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest operational documents, correspondence, and site notes not subject to ISF regulatory binder routing.
          </p>
        </div>
        
        <div className="rounded-md border border-dashed border-slate-300 p-12 text-center bg-slate-50">
          <FileText className="mx-auto h-8 w-8 text-slate-400 mb-3" />
          <h3 className="text-sm font-medium text-slate-900">
            {searchQuery ? 'No documents match your search' : 'No operational documents'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 mb-6">
            {searchQuery
              ? 'Try a different document name, filename, or classification.'
              : 'No study documents have been routed to this study.'}
          </p>
          <Link
            href={links.documentIntake}
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Open Document Center
          </Link>
        </div>
      </div>
    )
  }

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true
    const term = searchQuery.toLowerCase()
    return (
      (doc.operational_display_name || '').toLowerCase().includes(term) ||
      (doc.original_filename || '').toLowerCase().includes(term) ||
      (doc.document_classification || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Study Documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest operational documents, correspondence, and site notes not subject to ISF regulatory binder routing.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              className="h-9 w-[200px] rounded-md border border-slate-300 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <Link
            href={links.documentIntake}
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Intake Document
          </Link>
        </div>
      </div>

      <div className="border rounded-md bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm">
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
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear filter
            </button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>
            {searchQuery ? (
              <>
                Showing matches for <span className="font-medium text-slate-900">{searchQuery}</span>
              </>
            ) : (
              'Use search to narrow the document list before opening the full intake center.'
            )}
          </span>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => updateSearchQuery('')}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="divide-y divide-slate-100">
          {filteredDocuments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No documents match your search.
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <FileText className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">
                      {doc.operational_display_name || doc.original_filename}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="capitalize font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {doc.document_classification.replace(/_/g, ' ')}
                      </span>
                      <span>&bull;</span>
                      <span>
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(doc.created_at))}
                      </span>
                      <span>&bull;</span>
                      <span className={`capitalize ${doc.status === 'active' ? 'text-teal-600' : ''}`}>
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-slate-700 bg-white border hover:bg-slate-50 transition-colors">
                    <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />
                    View Intelligence
                  </button>
                  <button className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-slate-700 bg-white border hover:bg-slate-50 transition-colors">
                    <Info className="h-3.5 w-3.5 mr-1.5" />
                    View Metadata
                  </button>
                  <button className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-100 hover:bg-teal-100 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Open
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
