'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { newId } from '@/lib/source-builder/procedure-library'
import type { DraftProcedure, DraftVisit, MatrixMarker, MatrixRow } from '@/lib/source-builder/types'

type VisitProcedureMatrixProps = {
  visits: DraftVisit[]
  procedures: DraftProcedure[]
  matrix: MatrixRow[]
  onChange: (matrix: MatrixRow[]) => void
}

export function VisitProcedureMatrix({
  visits,
  procedures,
  matrix,
  onChange,
}: VisitProcedureMatrixProps) {
  function rowsFor(visitId: string, procedureId: string) {
    return matrix.find((r) => r.visitId === visitId && r.procedureId === procedureId)
  }

  function upsert(visitId: string, procedureId: string, enabled: boolean) {
    const existing = rowsFor(visitId, procedureId)
    if (!enabled && existing) {
      onChange(matrix.filter((r) => r.id !== existing.id))
      return
    }
    if (enabled && !existing) {
      onChange([
        ...matrix,
        {
          id: newId(),
          visitId,
          procedureId,
          marker: 'required',
          conditional: false,
          timingNote: '',
          operationalNote: '',
          windowNote: '',
        },
      ])
    }
  }

  function updateRow(id: string, patch: Partial<MatrixRow>) {
    onChange(matrix.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  if (visits.length === 0 || procedures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Visit × procedure matrix</CardTitle>
          <CardDescription>
            Add visits and procedures first, then assign procedures to visits.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Visit × procedure matrix</CardTitle>
        <CardDescription>
          Assign procedures to visits. Mark required, conditional, and add timing / operational
          notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2 font-medium">Procedure</th>
              {visits.map((v) => (
                <th key={v.id} className="min-w-[140px] p-2 font-medium">
                  {v.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {procedures.map((proc) => (
              <tr key={proc.id} className="border-b align-top">
                <td className="p-2 font-medium">{proc.displayName}</td>
                {visits.map((visit) => {
                  const row = rowsFor(visit.id, proc.id)
                  const checked = Boolean(row)
                  return (
                    <td key={visit.id} className="p-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => upsert(visit.id, proc.id, e.target.checked)}
                        />
                        <span className="text-xs text-muted-foreground">Assign</span>
                      </label>
                      {row ? (
                        <div className="mt-2 space-y-2">
                          <p className="space-y-1">
                            <Label className="text-xs">Marker</Label>
                            <select
                              className="h-8 w-full rounded-md border border-input px-2 text-xs"
                              value={row.marker}
                              onChange={(e) =>
                                updateRow(row.id, {
                                  marker: e.target.value as MatrixMarker,
                                })
                              }
                            >
                              <option value="required">Required</option>
                              <option value="optional">Optional</option>
                              <option value="not_done">Not done</option>
                            </select>
                          </p>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={row.conditional}
                              onChange={(e) =>
                                updateRow(row.id, { conditional: e.target.checked })
                              }
                            />
                            Conditional
                          </label>
                          <Input
                            className="h-8 text-xs"
                            placeholder="Timing note"
                            value={row.timingNote}
                            onChange={(e) =>
                              updateRow(row.id, { timingNote: e.target.value })
                            }
                          />
                          <Input
                            className="h-8 text-xs"
                            placeholder="Operational note"
                            value={row.operationalNote}
                            onChange={(e) =>
                              updateRow(row.id, { operationalNote: e.target.value })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive"
                            onClick={() => upsert(visit.id, proc.id, false)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
