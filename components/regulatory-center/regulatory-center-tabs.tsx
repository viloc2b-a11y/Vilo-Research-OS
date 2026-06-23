'use client'

import { useState } from 'react'
import { Shield, Users, FileText, AlertTriangle, Link2, PackageCheck, ChevronRight } from 'lucide-react'
import type { RegulatoryPersonnelEntry } from '@/lib/regulatory-center/regulatory-personnel'
import type { RegulatoryDocumentWithOwner } from '@/lib/regulatory-center/regulatory-master-documents'
import type { StudyLinkWithDetails, StudyInfo } from '@/lib/regulatory-center/study-regulatory-links'
import type { StudyRegulatoryDocumentEntry } from '@/lib/regulatory-center/study-regulatory-documents'
import { buildExpirationSummary } from '@/lib/regulatory-center/regulatory-expiration'
import { PersonnelSection } from './personnel-section'
import { MasterDocumentsSection } from './master-documents-section'
import { ExpirationsSection } from './expirations-section'
import { StudyLinksSection } from './study-links-section'
import { StudyRegulatoryPacketSection } from './study-regulatory-packet-section'

// ── Props ────────────────────────────────────────────────────────────────────

type RegulatoryCenterTabsProps = {
  personnel: RegulatoryPersonnelEntry[]
  documents: RegulatoryDocumentWithOwner[]
  studies: StudyInfo[]
  links: StudyLinkWithDetails[]
  studyRegDocs: Record<string, StudyRegulatoryDocumentEntry[]>
  organizationId: string
}

type TabId = 'overview' | 'personnel' | 'documents' | 'expirations' | 'study-links' | 'packets'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'expirations', label: 'Expirations', icon: AlertTriangle },
  { id: 'study-links', label: 'Study Links', icon: Link2 },
  { id: 'packets', label: 'Packets', icon: PackageCheck },
]

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color ?? 'text-slate-400'}`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-bold ${color ?? 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

// ── Checklist step ───────────────────────────────────────────────────────────

function ChecklistStep({
  step,
  title,
  done,
  current,
}: {
  step: number
  title: string
  done: boolean
  current: boolean
}) {
  return (
    <div className={`flex items-center gap-3 rounded-md border p-3 ${
      current ? 'border-teal-200 bg-teal-50' : done ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'
    }`}>
      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        done ? 'bg-green-500 text-white' : current ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-500'
      }`}>
        {done ? '✓' : step}
      </span>
      <span className={`text-sm ${done ? 'text-green-700 line-through' : current ? 'text-teal-800 font-medium' : 'text-slate-500'}`}>
        {title}
      </span>
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  personnel,
  documents,
  studies,
  links,
  onNavigate,
}: RegulatoryCenterTabsProps & { onNavigate: (tab: TabId) => void }) {
  const expSummary = buildExpirationSummary(documents)
  const linkedStudyIds = new Set(links.map((l) => l.study_id))

  const hasPersonnel = personnel.length > 0
  const hasDocuments = documents.length > 0
  const hasLinks = links.length > 0
  const currentStep = !hasPersonnel ? 1 : !hasDocuments ? 2 : !hasLinks ? 3 : 4

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800">Welcome to the Regulatory Center</h2>
        <p className="mt-1 text-xs text-slate-500">
          Master regulatory source of truth for personnel, documents, expirations, and study-specific
          regulatory execution. This is not a duplicate Document Center — the Regulatory Center is the
          master source; study regulatory is study-specific execution.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Users} label="Personnel" value={personnel.length} color="text-blue-600" />
        <MetricCard icon={FileText} label="Master Documents" value={documents.length} color="text-purple-600" />
        <MetricCard icon={AlertTriangle} label="Expired / Expiring" value={expSummary.expiringOrExpired} color={expSummary.expiringOrExpired > 0 ? 'text-red-600' : 'text-green-600'} />
        <MetricCard icon={Link2} label="Studies with Links" value={linkedStudyIds.size} color="text-teal-600" />
      </div>

      {/* Start here checklist */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-800">Getting Started</h3>
        <p className="mt-1 text-xs text-slate-500">
          Follow these steps to set up your regulatory center.
        </p>
        <div className="mt-4 space-y-2">
          <div onClick={() => onNavigate('personnel')} className="cursor-pointer">
            <ChecklistStep step={1} title="Add regulatory personnel (PIs, Sub-Is, Coordinators)" done={hasPersonnel} current={currentStep === 1} />
          </div>
          <div onClick={() => onNavigate('documents')} className="cursor-pointer">
            <ChecklistStep step={2} title="Upload master documents (CVs, licenses, GCP)" done={hasDocuments} current={currentStep === 2} />
          </div>
          <div onClick={() => onNavigate('study-links')} className="cursor-pointer">
            <ChecklistStep step={3} title="Link personnel and documents to studies" done={hasLinks} current={currentStep === 3} />
          </div>
          <div onClick={() => onNavigate('packets')} className="cursor-pointer">
            <ChecklistStep step={4} title="Review regulatory packet readiness per study" done={false} current={currentStep === 4} />
          </div>
        </div>
      </div>

      {/* Existing tools + Roadmap (collapsible) */}
      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-slate-600 hover:text-slate-800">
          Existing Regulatory Tools &amp; Roadmap
        </summary>
        <div className="space-y-4 px-6 pb-6">
          {/* Quick links */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Regulatory Intelligence', href: '/regulatory-intelligence', desc: 'IRB, training, and credentials' },
              { label: 'Inspection Readiness', href: '/inspection-readiness', desc: 'Audit and inspection preparation' },
              { label: 'Document Center', href: '/document-center', desc: 'Central document repository' },
            ].map((link) => (
              <a key={link.href} href={link.href}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50"
              >
                <div>
                  <span className="font-medium text-slate-700">{link.label}</span>
                  <p className="text-xs text-slate-400">{link.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </a>
            ))}
          </div>

          {/* Roadmap */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed Sprints</h4>
            <ol className="mt-2 space-y-1.5 text-xs text-slate-500">
              {['Regulatory Center Shell', 'Regulatory Personnel Registry', 'Master Regulatory Documents',
                'Expiration Intelligence', 'Study Regulatory Linking', 'Study Regulatory Packet',
                'Study-Specific Regulatory Runtime', 'Regulatory Command Center Signals',
              ].map((sprint, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{sprint}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function RegulatoryCenterTabs(props: RegulatoryCenterTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Shield className="h-4 w-4" />
          <span>Regulatory Center</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Regulatory Center
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab {...props} onNavigate={setActiveTab} />
        )}
        {activeTab === 'personnel' && (
          <PersonnelSection personnel={props.personnel} organizationId={props.organizationId} />
        )}
        {activeTab === 'documents' && (
          <MasterDocumentsSection documents={props.documents} personnel={props.personnel} organizationId={props.organizationId} />
        )}
        {activeTab === 'expirations' && (
          <ExpirationsSection documents={props.documents} />
        )}
        {activeTab === 'study-links' && (
          <StudyLinksSection
            studies={props.studies}
            links={props.links}
            personnel={props.personnel}
            documents={props.documents}
            organizationId={props.organizationId}
          />
        )}
        {activeTab === 'packets' && (
          <StudyRegulatoryPacketSection
            studies={props.studies}
            links={props.links}
            studySpecificDocs={props.studyRegDocs}
          />
        )}
      </div>
    </div>
  )
}
