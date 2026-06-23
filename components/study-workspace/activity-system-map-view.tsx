'use client'

import type { ActivitySystemMapWithSystem } from '@/lib/study-workspace/activity-system-map'
import { recordSystemLaunch } from '@/lib/study-workspace/study-systems-actions'

// ── Task System Card ──────────────────────────────────────────────────────────
// Shows the required external system for a task/activity, with launch button.

export function TaskSystemCard({
  mapping,
  activityLabel,
}: {
  mapping: ActivitySystemMapWithSystem | null
  activityLabel?: string
}) {
  if (!mapping) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">No system assigned</p>
        {activityLabel && (
          <p className="mt-0.5 text-[10px] text-slate-400">{activityLabel}</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-800">
            {mapping.system_name}
          </p>
          <p className="text-[10px] text-slate-400">
            {mapping.vendor_name}
            {mapping.vendor_name && mapping.system_type && <span> · </span>}
            {mapping.system_type}
          </p>
          {activityLabel && (
            <p className="mt-0.5 text-[10px] text-slate-400">{activityLabel}</p>
          )}
        </div>
        {mapping.default_url && (
          <a
            href={mapping.default_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordSystemLaunch(mapping.system_library_id, '')}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-900 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-slate-800"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Launch
          </a>
        )}
      </div>
    </div>
  )
}

// ── Activity System Map View ──────────────────────────────────────────────────
// Full mapping table showing all activity_code → system mappings.

export function ActivitySystemMapView({
  mappings,
}: {
  mappings: ActivitySystemMapWithSystem[]
}) {
  if (mappings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-6 text-center">
        <p className="text-sm text-slate-500">No task→system mappings configured.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">Activity</th>
            <th className="py-2 pr-3">System</th>
            <th className="py-2 pr-3">Vendor</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Primary</th>
            <th className="py-2 pr-3">Notes</th>
            <th className="py-2">Launch</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m) => (
            <tr
              key={m.activity_system_map_id}
              className="border-b border-slate-100 hover:bg-slate-50"
            >
              <td className="py-2 pr-3 font-medium text-slate-700">
                {m.activity_code}
              </td>
              <td className="py-2 pr-3 font-medium text-slate-800">
                {m.system_name}
              </td>
              <td className="py-2 pr-3 text-slate-500">
                {m.vendor_name ?? '—'}
              </td>
              <td className="py-2 pr-3 text-slate-500">{m.system_type}</td>
              <td className="py-2 pr-3">
                {m.is_primary ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                    Primary
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="py-2 pr-3 text-slate-400">
                {m.notes ?? '—'}
              </td>
              <td className="py-2">
                {m.default_url ? (
                  <a
                    href={m.default_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordSystemLaunch(m.system_library_id, '')}
                    className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-800"
                  >
                    Launch
                  </a>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── External System Required Filter ───────────────────────────────────────────
// For the Command Center — toggle to show/hide tasks requiring external systems.

export function ExternalSystemFilter({
  enabled,
  onToggle,
  externalCount,
  internalCount,
}: {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  externalCount: number
  internalCount: number
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Task Filter
      </h4>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggle(false)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            !enabled
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Tasks ({internalCount + externalCount})
        </button>
        <button
          type="button"
          onClick={() => onToggle(true)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            enabled
              ? 'bg-teal-700 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          External System Required ({externalCount})
        </button>
      </div>
    </div>
  )
}
