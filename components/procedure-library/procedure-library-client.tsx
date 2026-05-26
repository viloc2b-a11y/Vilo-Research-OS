'use client'

import { useEffect, useState } from 'react'
import type { ProcedureLibraryRow } from '@/lib/procedure-library/procedure-types'
import { ProcedureLibraryTable } from './procedure-library-table'
import { CreateProcedureDialog } from './create-procedure-dialog'
import { BlueprintVersionPanel } from './blueprint-version-panel'
import { AssignBlueprintDialog } from './assign-blueprint-dialog'

type StudyOption = { id: string; name: string }

type ProcedureLibraryClientProps = {
  organizationId: string
  studies: StudyOption[]
}

function ProcedureLibraryLoader({
  organizationId,
  children,
}: {
  organizationId: string
  children: (state: {
    procedures: ProcedureLibraryRow[]
    loading: boolean
    error: string | null
  }) => React.ReactNode
}) {
  const [procedures, setProcedures] = useState<ProcedureLibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/procedure-library?organization_id=${encodeURIComponent(organizationId)}&library_scope=all`,
        )
        const data = (await res.json()) as { procedures?: ProcedureLibraryRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load procedures')
        if (!cancelled) {
          setProcedures(data.procedures ?? [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load procedures')
          setProcedures([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  return <>{children({ procedures, loading, error })}</>
}

export function ProcedureLibraryClient({ organizationId, studies }: ProcedureLibraryClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Procedure library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reusable clinical procedures and versioned blueprints. Protocols compose procedures — they
          do not redefine them per study.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <CreateProcedureDialog
          organizationId={organizationId}
          onCreated={() => setRefreshKey((value) => value + 1)}
        />
      </div>

      <ProcedureLibraryLoader key={refreshKey} organizationId={organizationId}>
        {({ procedures, loading, error }) => {
          const selected = procedures.find((procedure) => procedure.id === selectedId) ?? null

          return (
            <>
              {loading ? <p className="text-sm text-slate-500">Loading procedures…</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="grid gap-6 lg:grid-cols-2">
                <ProcedureLibraryTable
                  procedures={procedures}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                {selectedId ? (
                  <BlueprintVersionPanel
                    key={`${selectedId}-${refreshKey}`}
                    procedureId={selectedId}
                    onUpdated={() => setRefreshKey((value) => value + 1)}
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
                    Select a procedure to view blueprint versions.
                  </div>
                )}
              </div>

              {selected ? (
                <AssignBlueprintDialog
                  organizationId={organizationId}
                  procedure={selected}
                  studies={studies}
                  onAssigned={() => setRefreshKey((value) => value + 1)}
                />
              ) : null}
            </>
          )
        }}
      </ProcedureLibraryLoader>
    </div>
  )
}
