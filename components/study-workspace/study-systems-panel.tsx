'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SystemLibraryEntry } from '@/lib/study-workspace/system-library'
import type { SystemWithUsage } from '@/lib/study-workspace/study-system-usage'
import type { StudyAccessData } from '@/lib/study-workspace/load-study-systems-with-usage'
import {
  addStudySystemFromLibrary,
  addStudySystemCustom,
  updateStudySystem,
  deleteStudySystem,
  recordSystemLaunch,
} from '@/lib/study-workspace/study-systems-actions'
import { StudyAccessReadinessPanel } from './study-access-readiness-panel'
import { ActivitySystemMapView } from './activity-system-map-view'
import type { ActivitySystemMapWithSystem } from '@/lib/study-workspace/activity-system-map'
import { TaskRecommendedSystem } from './system-recommendations-view'
import type { SystemRecommendationWithDetails } from '@/lib/study-workspace/system-recommendations'

// ── Types ─────────────────────────────────────────────────────────────────────

type StudySystemsPanelProps = {
  studyId: string
  allSystems: SystemWithUsage[]
  recentlyUsed: SystemWithUsage[]
  pinnedSystems: SystemWithUsage[]
  library: SystemLibraryEntry[]
  accessData: StudyAccessData
  activitySystemMappings: ActivitySystemMapWithSystem[]
  allRecommendations: SystemRecommendationWithDetails[]
}

type ModalState =
  | { type: 'closed' }
  | { type: 'add-from-library' }
  | { type: 'add-custom' }
  | { type: 'edit'; system: SystemWithUsage }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── System Card ───────────────────────────────────────────────────────────────

function SystemCard({
  system,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleActive,
  showLastUsed,
  showUsageCount,
}: {
  system: SystemWithUsage
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
  onToggleActive: () => void
  showLastUsed?: boolean
  showUsageCount?: boolean
}) {
  const isLibrary = !system.is_custom

  return (
    <div
      className={`rounded-md border p-4 ${
        system.active
          ? system.pinned
            ? 'border-teal-300 bg-teal-50'
            : 'border-slate-200 bg-white'
          : 'border-slate-200 bg-slate-50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Name + badge */}
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {system.system_name}
            </h3>
            {isLibrary ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                Library
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Custom
              </span>
            )}
            {system.pinned && (
              <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                Pinned
              </span>
            )}
          </div>

          {/* Vendor + Type + Category */}
          <p className="mt-1 text-xs text-slate-500">
            {system.vendor_name && <span>{system.vendor_name}</span>}
            {system.vendor_name && system.system_type && <span> · </span>}
            {system.system_type && <span>{system.system_type}</span>}
            {system.system_category && <span> · </span>}
            {system.system_category && <span>{system.system_category}</span>}
          </p>

          {/* Owner role */}
          {system.owner_role && (
            <p className="mt-0.5 text-xs text-slate-400">
              Owner: {system.owner_role}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Launch */}
          {system.launch_url && system.active && (
            <a
              href={system.launch_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordSystemLaunch(system.study_system_id, system.study_id)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Launch
            </a>
          )}
        </div>
      </div>

      {/* URLs + notes */}
      <div className="mt-3 space-y-1">
        {system.launch_url && (
          <p className="truncate text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Launch URL:</span>{' '}
            {system.launch_url}
          </p>
        )}
        {system.training_url && (
          <p className="truncate text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Training:</span>{' '}
            <a
              href={system.training_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 hover:underline"
            >
              {system.training_url}
            </a>
          </p>
        )}
        {system.support_url && (
          <p className="truncate text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Support:</span>{' '}
            <a
              href={system.support_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 hover:underline"
            >
              {system.support_url}
            </a>
          </p>
        )}
        {system.support_email && (
          <p className="truncate text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Support Email:</span>{' '}
            {system.support_email}
          </p>
        )}
        {system.login_notes && (
          <p className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Login Notes:</span>{' '}
            {system.login_notes}
          </p>
        )}

        {/* Usage metadata */}
        {showLastUsed && system.last_used && (
          <p className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Last used:</span>{' '}
            {new Date(system.last_used).toLocaleDateString()}
          </p>
        )}
        {showUsageCount && system.usage_count > 0 && (
          <p className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Used:</span>{' '}
            {system.usage_count} time{system.usage_count !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Actions bar */}
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={onTogglePin}
          className="text-xs text-slate-400 hover:text-teal-600"
          title={system.pinned ? 'Unpin' : 'Pin to top'}
        >
          {system.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          className={`text-xs ${
            system.active
              ? 'text-slate-400 hover:text-amber-600'
              : 'text-amber-500 hover:text-slate-700'
          }`}
        >
          {system.active ? 'Deactivate' : 'Reactivate'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-xs text-slate-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

// ── Add from library modal ────────────────────────────────────────────────────

function AddFromLibraryModal({
  library,
  studyId,
  onClose,
}: {
  library: SystemLibraryEntry[]
  studyId: string
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)
  const router = useRouter()

  const filtered = library.filter(
    (s) =>
      s.active &&
      (s.system_name.toLowerCase().includes(search.toLowerCase()) ||
        s.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        s.system_type.toLowerCase().includes(search.toLowerCase())),
  )

  const handleAdd = useCallback(
    async (librarySystemId: string) => {
      setSubmitting(librarySystemId)
      const result = await addStudySystemFromLibrary({ studyId, librarySystemId })
      setSubmitting(null)
      if (result.ok) {
        router.refresh()
        onClose()
      }
    },
    [studyId, router, onClose],
  )

  const grouped = filtered.reduce(
    (acc, s) => {
      const cat = s.system_category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    },
    {} as Record<string, SystemLibraryEntry[]>,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12">
      <div className="mx-4 w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Add from System Library</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>

        <div className="px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search systems..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            autoFocus
          />
        </div>

        <div className="max-h-96 overflow-y-auto px-5 pb-4">
          {Object.entries(grouped).map(([category, systems]) => (
            <div key={category} className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {category}
              </h3>
              <div className="space-y-1">
                {systems.map((s) => (
                  <button
                    key={s.system_id}
                    type="button"
                    disabled={submitting === s.system_id}
                    onClick={() => handleAdd(s.system_id)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <div>
                      <span className="font-medium text-slate-800">
                        {s.system_name}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {s.vendor_name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{s.system_type}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              {search
                ? 'No systems match your search.'
                : 'Library is empty.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add custom system modal ───────────────────────────────────────────────────

function AddCustomModal({
  studyId,
  onClose,
}: {
  studyId: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!name.trim() || !type.trim()) {
        setError('System name and type are required.')
        return
      }
      setError(null)
      setSubmitting(true)
      const result = await addStudySystemCustom({
        studyId,
        systemName: name.trim(),
        vendorName: vendor.trim() || null,
        systemType: type.trim(),
        systemCategory: category.trim() || null,
        launchUrl: url.trim() || null,
      })
      setSubmitting(false)
      if (result.ok) {
        router.refresh()
        onClose()
      } else {
        setError(result.error ?? 'Failed to add system')
      }
    },
    [studyId, name, vendor, type, category, url, router, onClose],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Add Custom System</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">
              System Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. My Custom EDC"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Vendor</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                System Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="e.g. EDC, IRT"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="e.g. Data Capture"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Launch URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="https://..."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add System'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  system,
  onClose,
}: {
  system: SystemWithUsage
  onClose: () => void
}) {
  const [launchUrl, setLaunchUrl] = useState(system.launch_url ?? '')
  const [supportEmail, setSupportEmail] = useState(system.support_email ?? '')
  const [supportUrl, setSupportUrl] = useState(system.support_url ?? '')
  const [trainingUrl, setTrainingUrl] = useState(system.training_url ?? '')
  const [loginNotes, setLoginNotes] = useState(system.login_notes ?? '')
  const [ownerRole, setOwnerRole] = useState(system.owner_role ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setSubmitting(true)
      const result = await updateStudySystem({
        studySystemId: system.study_system_id,
        launchUrl: launchUrl.trim() || null,
        supportEmail: supportEmail.trim() || null,
        supportUrl: supportUrl.trim() || null,
        trainingUrl: trainingUrl.trim() || null,
        loginNotes: loginNotes.trim() || null,
        ownerRole: ownerRole.trim() || null,
      })
      setSubmitting(false)
      if (result.ok) {
        router.refresh()
        onClose()
      } else {
        setError(result.error ?? 'Failed to update')
      }
    },
    [system.study_system_id, launchUrl, supportEmail, supportUrl, trainingUrl, loginNotes, ownerRole, router, onClose],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Edit — {system.system_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Launch URL</label>
            <input
              type="url"
              value={launchUrl}
              onChange={(e) => setLaunchUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Support URL</label>
              <input
                type="url"
                value={supportUrl}
                onChange={(e) => setSupportUrl(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Training URL</label>
              <input
                type="url"
                value={trainingUrl}
                onChange={(e) => setTrainingUrl(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Login Notes</label>
            <textarea
              value={loginNotes}
              onChange={(e) => setLoginNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="Any login instructions for this system..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Owner Role</label>
            <input
              type="text"
              value={ownerRole}
              onChange={(e) => setOwnerRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. CRC, PI, Coordinator"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function StudySystemsPanel({
  studyId,
  allSystems,
  recentlyUsed,
  pinnedSystems,
  library,
  accessData,
  activitySystemMappings,
  allRecommendations,
}: StudySystemsPanelProps) {
  const [modal, setModal] = useState<ModalState>({ type: 'closed' })
  const [showAccess, setShowAccess] = useState(false)
  const [showTaskMap, setShowTaskMap] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const router = useRouter()

  // Recently used IDs for deduplication in All Systems
  const recentlyUsedIds = new Set(recentlyUsed.map((s) => s.study_system_id))
  const pinnedIds = new Set(pinnedSystems.map((s) => s.study_system_id))

  // All active systems, excluding pinned and recently used (shown in their own sections)
  const remainingActive = allSystems.filter(
    (s) => s.active && !pinnedIds.has(s.study_system_id) && !recentlyUsedIds.has(s.study_system_id),
  )
  const inactiveSystems = allSystems.filter((s) => !s.active)

  const handleTogglePin = useCallback(
    async (system: SystemWithUsage) => {
      const action = system.pinned
        ? await (await import('@/lib/study-workspace/study-systems-actions')).unpinStudySystem
        : await (await import('@/lib/study-workspace/study-systems-actions')).pinStudySystem
      const result = await action(system.study_system_id)
      if (result.ok) router.refresh()
    },
    [router],
  )

  const handleToggleActive = useCallback(
    async (system: SystemWithUsage) => {
      const action = system.active
        ? await (await import('@/lib/study-workspace/study-systems-actions')).deactivateStudySystem
        : await (await import('@/lib/study-workspace/study-systems-actions')).reactivateStudySystem
      const result = await action(system.study_system_id)
      if (result.ok) router.refresh()
    },
    [router],
  )

  const handleDelete = useCallback(
    async (system: SystemWithUsage) => {
      if (!window.confirm(`Remove "${system.system_name}" from this study?`)) return
      const result = await deleteStudySystem(system.study_system_id)
      if (result.ok) router.refresh()
    },
    [router],
  )

  const renderSystemCard = (
    s: SystemWithUsage,
    opts?: { showLastUsed?: boolean; showUsageCount?: boolean },
  ) => (
    <SystemCard
      key={s.study_system_id}
      system={s}
      showLastUsed={opts?.showLastUsed}
      showUsageCount={opts?.showUsageCount}
      onEdit={() => setModal({ type: 'edit', system: s })}
      onDelete={() => handleDelete(s)}
      onTogglePin={() => handleTogglePin(s)}
      onToggleActive={() => handleToggleActive(s)}
    />
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Study Systems</h2>
          <p className="mt-1 text-sm text-slate-500">
            External systems used by this study. No credentials stored — launch URLs
            open in a new tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModal({ type: 'add-from-library' })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Add from Library
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'add-custom' })}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add Custom System
          </button>
        </div>
      </div>

      {/* No systems state */}
      {allSystems.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">
            No systems registered for this study yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Add systems from the library or create custom entries.
          </p>
        </div>
      )}

      {/* Pinned Systems */}
      {pinnedSystems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Pinned Systems
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinnedSystems.map((s) => renderSystemCard(s, { showLastUsed: true }))}
          </div>
        </div>
      )}

      {/* Recently Used Systems */}
      {recentlyUsed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recently Used
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentlyUsed.map((s) => renderSystemCard(s, { showLastUsed: true }))}
          </div>
        </div>
      )}

      {/* All Active Systems */}
      {remainingActive.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            All Systems ({remainingActive.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {remainingActive.map((s) => renderSystemCard(s, { showLastUsed: true }))}
          </div>
        </div>
      )}

      {/* Inactive systems */}
      {inactiveSystems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Inactive Systems ({inactiveSystems.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {inactiveSystems.map((s) => renderSystemCard(s))}
          </div>
        </div>
      )}

      {/* Task→System Mapping toggle */}
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowTaskMap(!showTaskMap)}
          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
        >
          <div>
            <span className="text-sm font-semibold text-slate-800">Task → System Mapping</span>
            <span className="ml-2 text-xs text-slate-400">
              ({activitySystemMappings.length} activity mappings)
            </span>
          </div>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${showTaskMap ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showTaskMap && (
          <div className="mt-4">
            <ActivitySystemMapView mappings={activitySystemMappings} />
          </div>
        )}
      </div>

      {/* Recommendations toggle */}
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowRecommendations(!showRecommendations)}
          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
        >
          <div>
            <span className="text-sm font-semibold text-slate-800">System Recommendations</span>
            <span className="ml-2 text-xs text-slate-400">
              ({allRecommendations.length} recommendations across {new Set(allRecommendations.map((r) => r.activity_code)).size} activities)
            </span>
          </div>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${showRecommendations ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showRecommendations && (
          <div className="mt-4 space-y-4">
            {allRecommendations.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">No recommendations configured.</p>
              </div>
            ) : (
              (() => {
                const grouped = allRecommendations.reduce(
                  (acc, r) => {
                    if (!acc[r.activity_code]) acc[r.activity_code] = []
                    acc[r.activity_code].push(r)
                    return acc
                  },
                  {} as Record<string, SystemRecommendationWithDetails[]>,
                )
                return Object.entries(grouped).map(([code, recs]) => (
                  <div key={code}>
                    <h4 className="mb-2 text-xs font-semibold text-slate-700">{code}</h4>
                    <div className="space-y-2">
                      {recs.map((r) => (
                        <div
                          key={r.recommendation_id}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                            r.is_default
                              ? 'border-teal-200 bg-teal-50'
                              : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {r.system_name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {r.vendor_name}
                            </span>
                            {r.is_default && (
                              <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">
                            Weight: {r.recommendation_weight}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
            )}
          </div>
        )}
      </div>

      {/* Access Readiness toggle */}
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowAccess(!showAccess)}
          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
        >
          <div>
            <span className="text-sm font-semibold text-slate-800">Access Readiness</span>
            <span className="ml-2 text-xs text-slate-400">
              ({accessData.readinessSummary.completed}/{accessData.readinessSummary.totalRequired} completed)
            </span>
          </div>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${showAccess ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showAccess && (
          <div className="mt-4">
            <StudyAccessReadinessPanel
              studyId={studyId}
              accessRecords={accessData.accessRecords}
              readinessSummary={accessData.readinessSummary}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {modal.type === 'add-from-library' && (
        <AddFromLibraryModal
          library={library}
          studyId={studyId}
          onClose={() => setModal({ type: 'closed' })}
        />
      )}
      {modal.type === 'add-custom' && (
        <AddCustomModal
          studyId={studyId}
          onClose={() => setModal({ type: 'closed' })}
        />
      )}
      {modal.type === 'edit' && (
        <EditModal
          system={modal.system}
          onClose={() => setModal({ type: 'closed' })}
        />
      )}
    </div>
  )
}
