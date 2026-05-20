// app/(ops)/studies/page.tsx
// Phase 7C — Studies Portfolio
// Entry point for the study hierarchy. Real data from DB.

import Link from 'next/link'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { orgAdminOrganizations } from '@/lib/studies/permissions'
import {
  FolderKanban,
  Users,
  AlertCircle,
  ChevronRight,
  CalendarDays,
  FileText,
  PenTool,
  Activity,
  Plus,
  Search,
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

interface StudyRow {
  id: string
  name: string
  slug: string | null
  status: string | null
  // STUB fields — add to DB schema when sponsor/phase columns exist
  // protocol_id, phase, pi_name, sponsor, enrolled_count, enrollment_target
}

// ============================================================================
// Status badge colors
// ============================================================================

function StudyStatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'unknown'
  const cfg: Record<string, { bg: string; text: string }> = {
    active:    { bg: 'bg-[#e8f5f3]',   text: 'text-[#2a8577]' },
    enrolling: { bg: 'bg-blue-50',     text: 'text-blue-700' },
    startup:   { bg: 'bg-purple-50',   text: 'text-purple-700' },
    'follow-up':{ bg: 'bg-amber-50',   text: 'text-amber-700' },
    closeout:  { bg: 'bg-[#f0eeec]',   text: 'text-[#98a5ad]' },
    unknown:   { bg: 'bg-[#f0eeec]',   text: 'text-[#98a5ad]' },
  }
  const c = cfg[s] ?? cfg.unknown
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {s}
    </span>
  )
}

// ============================================================================
// Study Card
// ============================================================================

function StudyCard({ study }: { study: StudyRow }) {
  // Generate a deterministic study color from name (until DB has color field)
  const COLORS = ['#3B82F6', '#8B5CF6', '#14B8A6', '#F59E0B', '#EC4899', '#34a090']
  const colorIdx = study.name.charCodeAt(0) % COLORS.length
  const studyColor = COLORS[colorIdx]

  return (
    <Link href={`/studies/${study.id}`} className="block vilo-card-interactive p-5 group">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: studyColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {study.slug && (
              <span className="mono-id">{study.slug}</span>
            )}
            <StudyStatusBadge status={study.status} />
          </div>
          <h3 className="font-semibold text-[#10253e] text-sm leading-snug">{study.name}</h3>
          {/* STUB: Phase · Therapeutic Area · Sponsor */}
          <p className="text-xs text-[#98a5ad] mt-0.5">
            Clinical Trial
          </p>
        </div>
      </div>

      {/* Operational summary — STUB until real columns exist */}
      <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#f9f8f7' }}>
        <p className="section-label mb-2">Pending Actions</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-[#98a5ad]">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-[#34a090]" />
            <span>Visits →</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Source →</span>
          </div>
          <div className="flex items-center gap-2">
            <PenTool className="w-3.5 h-3.5 text-orange-400" />
            <span>Signatures →</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[#98a5ad]" />
            <span>Findings →</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-3 border-t border-[#f0eeec]">
        <span className="text-xs text-[#98a5ad] transition-colors flex items-center gap-1 group-hover:text-[#34a090]">
          Open Study Workspace <ChevronRight className="w-3 h-3" />
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: studyColor }} />
        </div>
      </div>
    </Link>
  )
}

// ============================================================================
// Page
// ============================================================================

export default async function StudiesPortfolioPage() {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const canCreateStudy = orgAdminOrganizations(memberships).length > 0

  const supabase = await createServerClient()
  const { data: studies, error } = await supabase
    .from('studies')
    .select('id, name, slug, status')
    .order('name', { ascending: true })

  const activeCount   = studies?.filter(s => s.status === 'active' || s.status === 'enrolling').length ?? 0
  const atRiskCount   = 0 // STUB: until operational_status column exists
  const totalStudies  = studies?.length ?? 0

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#f9f8f7' }}>
      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-[#e5e5e5]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="heading-serif text-xl text-[#10253e]">Studies</h1>
            <p className="text-sm text-[#98a5ad]">Clinical Trial Portfolio</p>
          </div>
          {canCreateStudy ? (
            <Link href="/studies/new" className="vilo-btn-primary">
              <Plus className="w-4 h-4" />
              New Study
            </Link>
          ) : (
            <button
              type="button"
              className="vilo-btn-primary opacity-50 cursor-not-allowed"
              disabled
              title="Organization owner or admin role required"
            >
              <Plus className="w-4 h-4" />
              New Study
            </button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#e5e5e5]">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban className="w-4 h-4 text-[#34a090]" />
              <span className="text-xs text-[#98a5ad]">Total Studies</span>
            </div>
            <p className="text-2xl font-bold text-[#10253e]">{totalStudies}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#e5e5e5]">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-[#34a090]" />
              <span className="text-xs text-[#98a5ad]">Active / Enrolling</span>
            </div>
            <p className="text-2xl font-bold text-[#34a090]">{activeCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#e5e5e5]">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#98a5ad]" />
              <span className="text-xs text-[#98a5ad]">Total Subjects</span>
            </div>
            <p className="text-2xl font-bold text-[#98a5ad]">—</p>
            {/* STUB: count from study_subjects */}
          </div>
          <div className={`p-4 rounded-xl border ${atRiskCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-[#e5e5e5]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className={`w-4 h-4 ${atRiskCount > 0 ? 'text-red-500' : 'text-[#98a5ad]'}`} />
              <span className="text-xs text-[#98a5ad]">At Risk</span>
            </div>
            <p className={`text-2xl font-bold ${atRiskCount > 0 ? 'text-red-600' : 'text-[#98a5ad]'}`}>
              {atRiskCount > 0 ? atRiskCount : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-[#e5e5e5]">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98a5ad]" />
          <input
            type="text"
            placeholder="Search studies…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e5e5] text-sm bg-[#f9f8f7] focus:outline-none focus:ring-2 focus:ring-[#34a090] focus:border-transparent"
          />
        </div>
        <div className="flex rounded-lg p-0.5" style={{ backgroundColor: '#f0eeec' }}>
          {['All', 'Active', 'Enrolling', 'Follow-up', 'Closeout'].map(f => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                f === 'All' ? 'bg-white shadow-sm text-[#10253e]' : 'text-[#98a5ad] hover:bg-white/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Studies grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {error && (
          <p className="text-sm text-destructive">Could not load studies: {error.message}</p>
        )}
        {!studies?.length && !error && (
          <div className="vilo-card p-8 text-center max-w-md mx-auto mt-8">
            <FolderKanban className="w-8 h-8 text-[#98a5ad] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#10253e]">No studies visible</p>
            <p className="text-xs text-[#98a5ad] mt-1">
              You may not belong to any study roster yet, or no studies exist in your organization.
            </p>
          </div>
        )}
        {studies && studies.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {studies.map((study) => (
              <StudyCard key={study.id} study={study} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
