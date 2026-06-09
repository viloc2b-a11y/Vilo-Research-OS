'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, FileText, Search, ExternalLink, Info, BrainCircuit } from 'lucide-react'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { ComplianceRuntimeDocument } from '@/lib/document-intake/compliance-types'

const BINDER_SECTIONS = [
  '01 Study Startup',
  '02 Feasibility & Selection',
  '03 Contracts & Budgets',
  '04 IRB / Ethics',
  '05 Regulatory Approvals',
  '06 Investigator & Site Qualifications',
  '07 Training',
  '08 Delegation Logs',
  '09 Informed Consent',
  '10 IRB Correspondence',
  '11 Regulatory Authorities',
  '12 Protocol & Amendments',
  '13 Investigator Brochure',
  '14 Safety',
  '15 Efficacy',
  '16 Investigational Product',
  '17 Imaging',
  '18 eCOA',
  '19 RTSM',
  '20 Central Lab',
  '21 Biospecimens',
  '22 EDC / CRF',
  '23 Correspondence',
  '24 NTF',
  '25 BIRC',
  '26 Other Documents',
  '27 Monitoring',
  '28 CAPA',
  '29 Deviations',
  '30 Audit / Inspection',
  '31 Vendor Management',
  '32 Pharmacy',
  '33 Laboratory Certifications',
  '34 Closeout',
]

function SectionFolder({
  sectionName,
  documents,
}: {
  sectionName: string
  documents: ComplianceRuntimeDocument[]
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const count = documents.length

  return (
    <div className="border rounded-md bg-white mb-2 overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
          <span className="font-medium text-slate-800 text-sm">{sectionName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            {count} {count === 1 ? 'document' : 'documents'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 bg-white">
          {count === 0 ? (
            <div className="px-10 py-6 text-sm text-slate-500 italic">No documents</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="px-4 py-3 sm:px-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">
                        {doc.operational_display_name || doc.original_filename}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="capitalize">{doc.document_classification.replace(/_/g, ' ')}</span>
                        <span>&bull;</span>
                        <span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(doc.created_at))}</span>
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type StudyRegulatoryBinderViewProps = {
  studyId: string
  links: StudyWorkspaceRuntimeLinks
  documents: ComplianceRuntimeDocument[]
  searchQuery: string
}

export function StudyRegulatoryBinderView({
  studyId,
  links,
  documents,
  searchQuery,
}: StudyRegulatoryBinderViewProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const hasActiveFilter = Boolean(searchQuery.trim())

  function updateSearchQuery(value: string) {
    const params = new URLSearchParams(currentSearchParams.toString())
    if (value.trim()) params.set('binder_q', value.trim())
    else params.delete('binder_q')
    router.replace(`/studies/${studyId}/workspace?${params.toString()}`, { scroll: false })
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Regulatory Binder</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest Investigator Site File (ISF) documents populated by the document compliance engine.
          </p>
        </div>
        
        <div className="rounded-md border border-dashed border-slate-300 p-12 text-center bg-slate-50">
          <FileText className="mx-auto h-8 w-8 text-slate-400 mb-3" />
          <h3 className="text-sm font-medium text-slate-900">
            {searchQuery ? 'No documents match your search' : 'No regulatory documents found'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 mb-6">
            {searchQuery
              ? 'Try a different document name, filename, classification, or binder section.'
              : 'No regulatory documents have been routed to this study.'}
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

  // Group documents by binder section
  const documentsBySection = BINDER_SECTIONS.reduce((acc, sectionName) => {
    acc[sectionName] = []
    return acc
  }, {} as Record<string, ComplianceRuntimeDocument[]>)

  // Place documents in appropriate sections based on metadata
  documents.forEach((doc) => {
    const assignedSection = String(doc.metadata?.binder_section || '')
    // Fuzzy match against our known sections if possible
    const targetSection = BINDER_SECTIONS.find(s => s === assignedSection || s.includes(assignedSection) || assignedSection.includes(s))
      || '26 Other Documents' // Default fallback
    
    if (documentsBySection[targetSection]) {
      documentsBySection[targetSection].push(doc)
    } else {
      documentsBySection['26 Other Documents'].push(doc)
    }
  })

  // Optional: Filter by search
  const filteredSections = BINDER_SECTIONS.filter(sectionName => {
    if (!searchQuery) return true
    
    // Check if section matches
    if (sectionName.toLowerCase().includes(searchQuery.toLowerCase())) return true
    
    // Check if any documents in section match
    return documentsBySection[sectionName].some(doc => 
      (doc.operational_display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.original_filename || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Regulatory Binder</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest Investigator Site File (ISF) documents populated by the document compliance engine.
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

      <div className="bg-slate-50/50 p-2 rounded-lg border">
        <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
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
        <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <span>
            {searchQuery ? (
              <>
                Showing matches for <span className="font-medium text-slate-900">{searchQuery}</span>
              </>
            ) : (
              'Use search to narrow the binder before expanding sections.'
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
        {filteredSections.map((sectionName) => (
          <SectionFolder
            key={sectionName}
            sectionName={sectionName}
            documents={documentsBySection[sectionName]}
          />
        ))}
        {filteredSections.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-500">
            No sections or documents match your search.
          </div>
        )}
      </div>
    </div>
  )
}
