'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RegulatoryPersonnelEntry } from '@/lib/regulatory-center/regulatory-personnel'
import { REGULATORY_ROLES, PERSONNEL_STATUSES } from '@/lib/regulatory-center/regulatory-personnel'
import {
  createRegulatoryPersonnel,
  updateRegulatoryPersonnel,
  deactivateRegulatoryPersonnel,
  reactivateRegulatoryPersonnel,
} from '@/lib/regulatory-center/regulatory-personnel-actions'

// ── Props ────────────────────────────────────────────────────────────────────

type PersonnelSectionProps = {
  personnel: RegulatoryPersonnelEntry[]
  organizationId: string
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    active: { bg: 'bg-green-100', text: 'text-green-700' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-500' },
    needs_review: { bg: 'bg-amber-100', text: 'text-amber-700' },
  }
  const c = cfg[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      {role}
    </span>
  )
}

// ── Add/Edit form ────────────────────────────────────────────────────────────

function PersonnelForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: RegulatoryPersonnelEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'Coordinator')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [npi, setNpi] = useState(initial?.npi ?? '')
  const [licenseNumber, setLicenseNumber] = useState(initial?.license_number ?? '')
  const [deaNumber, setDeaNumber] = useState(initial?.dea_number ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!fullName.trim()) {
        setError('Full name is required')
        return
      }
      setError(null)
      setSubmitting(true)

      const result = initial
        ? await updateRegulatoryPersonnel({
            id: initial.id,
            fullName: fullName.trim(),
            role: role as any,
            email: email.trim() || null,
            phone: phone.trim() || null,
            npi: npi.trim() || null,
            licenseNumber: licenseNumber.trim() || null,
            deaNumber: deaNumber.trim() || null,
            notes: notes.trim() || null,
          })
        : await createRegulatoryPersonnel({
            fullName: fullName.trim(),
            role: role as any,
            email: email.trim() || null,
            phone: phone.trim() || null,
            npi: npi.trim() || null,
            licenseNumber: licenseNumber.trim() || null,
            deaNumber: deaNumber.trim() || null,
            notes: notes.trim() || null,
          })

      setSubmitting(false)
      if (result.ok) {
        onSaved()
      } else {
        setError(result.error ?? 'Failed to save')
      }
    },
    [initial, fullName, role, email, phone, npi, licenseNumber, deaNumber, notes, onSaved],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">
        {initial ? 'Edit Personnel' : 'Add Personnel'}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="Dr. Jane Smith"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {REGULATORY_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">NPI</label>
          <input
            type="text"
            value={npi}
            onChange={(e) => setNpi(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">License Number</label>
          <input
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">DEA Number</label>
          <input
            type="text"
            value={deaNumber}
            onChange={(e) => setDeaNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
          {submitting ? 'Saving...' : initial ? 'Save Changes' : 'Add Personnel'}
        </button>
      </div>
    </form>
  )
}

// ── Personnel Card ───────────────────────────────────────────────────────────

function PersonnelCard({
  person,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  person: RegulatoryPersonnelEntry
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {person.full_name}
            </h3>
            <RoleBadge role={person.role} />
            <StatusBadge status={person.status} />
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            {person.email && <p>{person.email}</p>}
            {person.phone && <p>{person.phone}</p>}
            <div className="flex flex-wrap gap-3">
              {person.npi && <p><span className="font-medium text-slate-400">NPI:</span> {person.npi}</p>}
              {person.license_number && <p><span className="font-medium text-slate-400">License:</span> {person.license_number}</p>}
              {person.dea_number && <p><span className="font-medium text-slate-400">DEA:</span> {person.dea_number}</p>}
            </div>
            {person.notes && <p className="mt-1 italic text-slate-400">{person.notes}</p>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          Edit
        </button>
        {person.status === 'active' ? (
          <button
            type="button"
            onClick={onDeactivate}
            className="text-xs text-slate-400 hover:text-amber-600"
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            onClick={onReactivate}
            className="text-xs text-slate-400 hover:text-green-600"
          >
            Reactivate
          </button>
        )}
      </div>
    </div>
  )
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  roleFilter: string
  onRoleFilterChange: (v: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or email..."
        className="min-w-[200px] rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <select
        value={roleFilter}
        onChange={(e) => onRoleFilterChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        <option value="">All Roles</option>
        {REGULATORY_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        <option value="">All Statuses</option>
        {PERSONNEL_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function PersonnelSection({ personnel, organizationId }: PersonnelSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RegulatoryPersonnelEntry | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const router = useRouter()

  const refresh = useCallback(() => {
    setShowForm(false)
    setEditing(null)
    router.refresh()
  }, [router])

  // Filtering
  const filtered = personnel.filter((p) => {
    if (roleFilter && p.role !== roleFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.full_name.toLowerCase().includes(q) && !(p.email ?? '').toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  const activePersonnel = filtered.filter((p) => p.status === 'active')
  const inactivePersonnel = filtered.filter((p) => p.status !== 'active')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Personnel</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {personnel.length} registered · {personnel.filter((p) => p.status === 'active').length} active
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(!showForm) }}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancel' : 'Add Personnel'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && !editing && (
        <div className="mt-4">
          <PersonnelForm onClose={() => setShowForm(false)} onSaved={refresh} />
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <PersonnelForm initial={editing} onClose={() => setEditing(null)} onSaved={refresh} />
        </div>
      )}

      {/* Filter bar */}
      <div className="mt-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </div>

      {/* Empty state */}
      {personnel.length === 0 && !showForm && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-400">No personnel registered</p>
          <p className="mt-1 text-xs text-slate-300">
            Add the first staff member or investigator to get started.
          </p>
        </div>
      )}

      {/* Active personnel */}
      {activePersonnel.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Active ({activePersonnel.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePersonnel.map((p) => (
              <PersonnelCard
                key={p.id}
                person={p}
                onEdit={() => setEditing(p)}
                onDeactivate={async () => {
                  await deactivateRegulatoryPersonnel(p.id)
                  router.refresh()
                }}
                onReactivate={async () => {
                  await reactivateRegulatoryPersonnel(p.id)
                  router.refresh()
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive personnel */}
      {inactivePersonnel.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Inactive / Needs Review ({inactivePersonnel.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inactivePersonnel.map((p) => (
              <PersonnelCard
                key={p.id}
                person={p}
                onEdit={() => setEditing(p)}
                onDeactivate={async () => {
                  await deactivateRegulatoryPersonnel(p.id)
                  router.refresh()
                }}
                onReactivate={async () => {
                  await reactivateRegulatoryPersonnel(p.id)
                  router.refresh()
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* No results from filter */}
      {personnel.length > 0 && filtered.length === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-xs text-slate-400">No personnel match your filters.</p>
        </div>
      )}
    </div>
  )
}
