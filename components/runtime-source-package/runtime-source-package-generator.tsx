'use client'

import { useState } from 'react'

type StudyOption = { id: string; name: string }
type SnapshotOption = { id: string; graphHash: string; createdAt: string }

type RuntimeSourcePackageGeneratorProps = {
  organizationId: string
  studies: StudyOption[]
  snapshotsByStudy: Record<string, SnapshotOption[]>
  onGenerated: (packageId: string) => void
}

export function RuntimeSourcePackageGenerator({
  organizationId,
  studies,
  snapshotsByStudy,
  onGenerated,
}: RuntimeSourcePackageGeneratorProps) {
  const [studyId, setStudyId] = useState(studies[0]?.id ?? '')
  const [snapshotId, setSnapshotId] = useState(snapshotsByStudy[studies[0]?.id ?? '']?.[0]?.id ?? '')
  const [packageName, setPackageName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)

  const snapshots = snapshotsByStudy[studyId] ?? []

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!studyId || !snapshotId || !packageName.trim()) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/runtime-source-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          composition_snapshot_id: snapshotId,
          package_name: packageName.trim(),
        }),
      })
      const data = (await res.json()) as {
        package_id?: string
        package_hash?: string
        error?: string
      }
      if (!res.ok || !data.package_id) {
        throw new Error(data.error || 'Failed to generate source package')
      }
      setLastHash(data.package_hash ?? null)
      setPackageName('')
      onGenerated(data.package_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate source package')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleGenerate(e)} className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
      <h3 className="font-semibold text-slate-800">Generate source package draft</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm text-slate-600">
          Study
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={studyId}
            onChange={(e) => {
              setStudyId(e.target.value)
              const nextSnapshots = snapshotsByStudy[e.target.value] ?? []
              setSnapshotId(nextSnapshots[0]?.id ?? '')
            }}
          >
            {studies.map((study) => (
              <option key={study.id} value={study.id}>{study.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Compiled snapshot
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
          >
            {snapshots.length === 0 ? (
              <option value="">No compiled snapshots</option>
            ) : (
              snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.graphHash.slice(0, 12)}… · {new Date(snapshot.createdAt).toLocaleString()}
                </option>
              ))
            )}
          </select>
        </label>
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
          placeholder="Package name (e.g. PARA_OA_012 Source Draft v1)"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          required
        />
      </div>
      {lastHash ? (
        <p className="text-xs text-emerald-700">Last package hash: {lastHash}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading || !snapshotId}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate package'}
      </button>
    </form>
  )
}
