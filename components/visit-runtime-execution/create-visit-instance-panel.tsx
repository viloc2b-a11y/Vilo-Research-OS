'use client'

import { useState } from 'react'

type PackageOption = { id: string; packageName: string; packageVersion: number }
type VisitShellOption = { id: string; visitCode: string; visitName: string }

type CreateVisitInstancePanelProps = {
  organizationId: string
  studyId: string
  subjectId: string
  packages: PackageOption[]
  visitShellsByPackage: Record<string, VisitShellOption[]>
  onCreated: (visitInstanceId: string) => void
}

export function CreateVisitInstancePanel({
  organizationId,
  studyId,
  subjectId,
  packages,
  visitShellsByPackage,
  onCreated,
}: CreateVisitInstancePanelProps) {
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '')
  const [visitShellId, setVisitShellId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visitShells = visitShellsByPackage[packageId] ?? []
  const effectiveVisitShellId = visitShellId || visitShells[0]?.id || ''

  async function handleCreate() {
    if (!packageId || !effectiveVisitShellId) {
      setError('Select a source package and visit shell.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/visit-runtime/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          subject_id: subjectId,
          source_package_id: packageId,
          visit_shell_id: effectiveVisitShellId,
        }),
      })
      const data = (await res.json()) as { visit_instance_id?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create visit workspace')
      if (data.visit_instance_id) onCreated(data.visit_instance_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit workspace')
    } finally {
      setLoading(false)
    }
  }

  if (!subjectId) {
    return <p className="text-sm text-slate-500">Select a subject to create a visit workspace.</p>
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Create visit workspace</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Source package
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value)
              setVisitShellId('')
            }}
          >
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.packageName} (v{pkg.packageVersion})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Visit shell
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={effectiveVisitShellId}
            onChange={(e) => setVisitShellId(e.target.value)}
          >
            {visitShells.map((shell) => (
              <option key={shell.id} value={shell.id}>
                {shell.visitCode} · {shell.visitName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={loading || packages.length === 0}
          onClick={() => void handleCreate()}
        >
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
