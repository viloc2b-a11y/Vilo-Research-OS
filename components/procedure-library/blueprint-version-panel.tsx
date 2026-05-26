'use client'

import { useEffect, useState } from 'react'
import type { ProcedureBlueprintVersionRow, BlueprintJson } from '@/lib/procedure-library/procedure-types'
import { buildFieldSchemaFromBlueprint } from '@/lib/procedure-library/procedure-types'
import type { LoadedProcedureBlueprint } from '@/lib/procedure-library/load-blueprint'
import { BlueprintJsonEditor } from './blueprint-json-editor'

type BlueprintVersionPanelProps = {
  procedureId: string
  onUpdated: () => void
}

export function BlueprintVersionPanel({ procedureId, onUpdated }: BlueprintVersionPanelProps) {
  const [loaded, setLoaded] = useState<LoadedProcedureBlueprint | null>(null)
  const [draftBlueprint, setDraftBlueprint] = useState<BlueprintJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/procedure-library/${procedureId}/versions`)
        const data = (await res.json()) as LoadedProcedureBlueprint & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load blueprint')
        if (!cancelled) {
          setLoaded(data)
          setDraftBlueprint(data.activeVersion?.blueprintJson ?? data.versions[0]?.blueprintJson ?? null)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
          setLoaded(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [procedureId])

  async function createDraftVersion() {
    if (!draftBlueprint) return
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/procedure-library/${procedureId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprint_json: draftBlueprint,
          field_schema: buildFieldSchemaFromBlueprint(draftBlueprint),
          dependency_schema: loaded?.activeVersion?.dependencySchema ?? {},
          operational_rules: loaded?.activeVersion?.operationalRules ?? {},
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create version')
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version')
    } finally {
      setActionLoading(false)
    }
  }

  async function publishVersion(version: ProcedureBlueprintVersionRow) {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/procedure-library/${procedureId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: version.id }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to publish')
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading blueprint…</p>
  if (!loaded) return <p className="text-sm text-red-600">{error ?? 'Procedure not found'}</p>

  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <div>
        <h3 className="font-semibold text-slate-800">{loaded.procedure.procedureName}</h3>
        <p className="text-xs text-slate-500">
          {loaded.procedure.procedureCode} · {loaded.procedure.procedureCategory}
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700">Versions</h4>
        <ul className="space-y-1 text-sm">
          {loaded.versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1">
              <span>
                v{version.versionNumber} · {version.blueprintStatus}
                {loaded.procedure.activeVersionId === version.id ? ' · active' : ''}
              </span>
              {version.blueprintStatus === 'draft' ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void publishVersion(version)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Publish
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {draftBlueprint ? (
        <BlueprintJsonEditor
          value={draftBlueprint}
          onChange={setDraftBlueprint}
          readOnly={false}
        />
      ) : null}

      <button
        type="button"
        disabled={actionLoading || !draftBlueprint}
        onClick={() => void createDraftVersion()}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Save as new draft version
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
