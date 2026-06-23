import Link from 'next/link'
import {
  Shield,
  Users,
  FileText,
  AlertTriangle,
  Link2,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import { loadRegulatoryPersonnel } from '@/lib/regulatory-center/regulatory-personnel'
import { PersonnelSection } from '@/components/regulatory-center/personnel-section'
import { MasterDocumentsSection } from '@/components/regulatory-center/master-documents-section'
import { ExpirationsSection } from '@/components/regulatory-center/expirations-section'
import { StudyLinksSection } from '@/components/regulatory-center/study-links-section'
import { StudyRegulatoryPacketSection } from '@/components/regulatory-center/study-regulatory-packet-section'
import { loadRegulatoryDocuments } from '@/lib/regulatory-center/regulatory-master-documents'
import { loadOrgStudies, loadStudyLinks } from '@/lib/regulatory-center/study-regulatory-links'
import { loadStudyRegulatoryDocuments } from '@/lib/regulatory-center/study-regulatory-documents'

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  status,
}: {
  icon: React.ElementType
  title: string
  description: string
  actionLabel: string
  actionHref: string
  status: 'empty' | 'coming-soon'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="rounded-md bg-slate-100 p-3">
          <Icon className="h-6 w-6 text-slate-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {status === 'coming-soon' && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                Coming soon
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{description}</p>

          {/* Empty state */}
          {status === 'empty' && (
            <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-medium text-slate-400">Nothing registered yet</p>
              <p className="mt-0.5 text-[10px] text-slate-300">
                Add the first entry to get started.
              </p>
              <Link
                href={actionHref}
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-3 w-3" />
                {actionLabel}
              </Link>
            </div>
          )}

          {/* Coming soon state */}
          {status === 'coming-soon' && (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4 text-center">
              <p className="text-xs font-medium text-blue-600">Planned for a future sprint</p>
              <p className="mt-0.5 text-[10px] text-blue-400">
                This section will be available in an upcoming release.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    label: 'Regulatory Intelligence',
    href: '/regulatory-intelligence',
    description: 'IRB, training, and credentials',
  },
  {
    label: 'Inspection Readiness',
    href: '/inspection-readiness',
    description: 'Audit and inspection preparation',
  },
  {
    label: 'Document Center',
    href: '/document-center',
    description: 'Central document repository',
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RegulatoryCenterPage() {
  const user = await getSessionUser()
  let personnel: Awaited<ReturnType<typeof loadRegulatoryPersonnel>> = []
  let orgId: string | null = null

  if (user) {
    orgId = await getPrimaryOrganizationId(user.id)
    if (orgId) {
      const supabase = await createServerClient()
      personnel = await loadRegulatoryPersonnel(supabase, orgId)
    }
  }

  let documents: Awaited<ReturnType<typeof loadRegulatoryDocuments>> = []
  let studies: Awaited<ReturnType<typeof loadOrgStudies>> = []
  let links: Awaited<ReturnType<typeof loadStudyLinks>> = []
  let studyRegDocs: Record<string, Awaited<ReturnType<typeof loadStudyRegulatoryDocuments>>> = {}

  if (orgId) {
    const supabase = await createServerClient()
    documents = await loadRegulatoryDocuments(supabase, orgId, { personnel })
    studies = await loadOrgStudies(supabase, orgId)
    // Load links for all studies (batch the first 20)
    const linkedStudies = studies.slice(0, 20)
    const allLinks = await Promise.all(
      linkedStudies.map((s) => loadStudyLinks(supabase, orgId, s.id)),
    )
    links = allLinks.flat()

    // Load study-specific regulatory documents for each study
    const studyRegDocs: Record<string, Awaited<ReturnType<typeof loadStudyRegulatoryDocuments>>> = {}
    for (const s of linkedStudies) {
      studyRegDocs[s.id] = await loadStudyRegulatoryDocuments(supabase, s.id)
    }
  }

  return (
    <CoordinatorPageScroll>
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Shield className="h-4 w-4" />
            <span>Regulatory Center</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Regulatory Center
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Master regulatory source of truth for personnel, documents, expirations, and
            study-specific regulatory execution.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            This is not a duplicate Document Center. The Regulatory Center is the master source;
            study regulatory is study-specific execution.
          </p>
        </div>

        {/* Section grid */}
        <div className="space-y-4">
          <PersonnelSection personnel={personnel} organizationId={orgId ?? ''} />

          <MasterDocumentsSection documents={documents} personnel={personnel} organizationId={orgId ?? ''} />

          <ExpirationsSection documents={documents} />

          <StudyLinksSection
            studies={studies}
            links={links}
            personnel={personnel}
            documents={documents}
            organizationId={orgId ?? ''}
          />

          <StudyRegulatoryPacketSection
            studies={studies}
            links={links}
            studySpecificDocs={studyRegDocs}
          />
        </div>

        {/* Quick links to existing regulatory-adjacent pages */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Existing Regulatory Tools
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50"
              >
                <div>
                  <span className="font-medium text-slate-700">{link.label}</span>
                  <p className="text-xs text-slate-400">{link.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>

        {/* Regulatory Center roadmap */}
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Regulatory Center Roadmap</h2>
          <ol className="mt-3 space-y-2 text-xs text-slate-500">
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">1</span>
              <span className="font-medium text-slate-700">Regulatory Center Shell</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">2</span>
              <span className="font-medium text-slate-700">Regulatory Personnel Registry</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">3</span>
              <span className="font-medium text-slate-700">Master Regulatory Documents</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">4</span>
              <span className="font-medium text-slate-700">Expiration Intelligence</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">5</span>
              <span className="font-medium text-slate-700">Study Regulatory Linking</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">6</span>
              <span className="font-medium text-slate-700">Study Regulatory Packet</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">7</span>
              <span className="font-medium text-slate-700">Study-Specific Regulatory Runtime</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">8</span>
              <span className="font-medium text-slate-700">Regulatory Command Center Signals</span>
              <span className="text-green-600">✓ Complete</span>
            </li>
          </ol>
        </div>
      </div>
    </CoordinatorPageScroll>
  )
}
