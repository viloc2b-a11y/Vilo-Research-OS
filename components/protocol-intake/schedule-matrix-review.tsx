'use client'

import { useState } from 'react'
import type { ScheduleMatrixIntersection } from '@/lib/protocol-intake/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Props = {
  intersections: ScheduleMatrixIntersection[]
  draftId: string
  organizationId: string
}

export function ScheduleMatrixReview({ intersections }: Props) {
  // We'll group intersections by procedure_name to build rows, and visit_name to build columns
  const data = intersections
  
  const visits = Array.from(new Set(data.map(i => i.visit_name)))
  const procedures = Array.from(new Set(data.map(i => i.procedure_name)))

  const [selectedProcedures, setSelectedProcedures] = useState<Set<string>>(new Set(procedures))
  const [procedureNames, setProcedureNames] = useState<Record<string, string>>(
    Object.fromEntries(procedures.map(p => [p, p]))
  )

  function toggleProcedure(proc: string) {
    const next = new Set(selectedProcedures)
    if (next.has(proc)) next.delete(proc)
    else next.add(proc)
    setSelectedProcedures(next)
  }

  function handleNameChange(proc: string, newName: string) {
    setProcedureNames(prev => ({ ...prev, [proc]: newName }))
  }

  return (
    <Card className="p-4 overflow-x-auto">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Procedure Matrix Checklist</h3>
          <p className="text-sm text-muted-foreground">Review the extracted schedule. Low confidence or conditional items are highlighted.</p>
        </div>
        <Button onClick={() => alert('Approve and Proceed to Builder (Phase 2)')}>
          Approve Matrix
        </Button>
      </div>

      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 border font-medium w-8 text-center">Inc</th>
            <th className="p-2 border font-medium">Procedure</th>
            {visits.map(v => (
              <th key={v} className="p-2 border font-medium text-center">{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {procedures.map(procName => (
            <tr key={procName} className={`border-b ${!selectedProcedures.has(procName) ? 'opacity-50' : ''}`}>
              <td className="p-2 border text-center">
                <input 
                  type="checkbox" 
                  checked={selectedProcedures.has(procName)} 
                  onChange={() => toggleProcedure(procName)}
                />
              </td>
              <td className="p-2 border font-medium bg-muted/30 max-w-[200px]">
                <input 
                  value={procedureNames[procName] || ''}
                  onChange={e => handleNameChange(procName, e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium"
                />
              </td>
              {visits.map(visitName => {
                const cell = data.find(i => i.procedure_name === procName && i.visit_name === visitName)
                
                if (!cell) {
                  return <td key={visitName} className="p-2 border text-center text-muted-foreground">-</td>
                }

                const needsReview = cell.needs_review || cell.confidence_score === 'low'
                const isConditional = cell.conditionality

                return (
                  <td 
                    key={visitName} 
                    className={`p-2 border text-center relative ${needsReview ? 'bg-amber-100 dark:bg-amber-900/30' : ''}`}
                    title={cell.source_note || undefined}
                  >
                    {cell.required_status ? 'X' : isConditional ? '(X)' : '-'}
                    {isConditional && (
                      <span className="block text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                        Conditional
                      </span>
                    )}
                    {needsReview && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full" title="Needs Review" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
