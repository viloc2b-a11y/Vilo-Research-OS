'use client'

import { useState } from 'react'
import { VISIT_TYPES, type VisitType } from '@/lib/study-runtime-composition/runtime-composition-types'

type CreateVisitDialogProps = {
  organizationId: string
  studyId: string
  nextSequenceOrder: number
  onCreated: () => void
}

export function CreateVisitDialog({
  organizationId,
  studyId,
  nextSequenceOrder,
  onCreated,
}: CreateVisitDialogProps) {
  const [open, setOpen] = useState(false)
  const [visitCode, setVisitCode] = useState('')
  const [visitName, setVisitName] = useState('')
  const [visitType, setVisitType] = useState<VisitType>('screening')
  const [studyDay, setStudyDay] = useState('')
  const [windowBefore, setWindowBefore] = useState('')
  const [windowAfter, setWindowAfter] = useState('')
  const [modes, setModes] = useState<string[]>(['onsite'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleMode(mode: string) {
    setModes((current) =>
      current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/study-runtime/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          visit_code: visitCode,
          visit_name: visitName,
          visit_type: visitType,
          study_day: studyDay ? Number(studyDay) : null,
          window_before_days: windowBefore ? Number(windowBefore) : null,
          window_after_days: windowAfter ? Number(windowAfter) : null,
          sequence_order: nextSequenceOrder,
          allowed_modes: modes.length ? modes : ['onsite'],
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create visit')
      setOpen(false)
      setVisitCode('')
      setVisitName('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Add visit
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
      <h3 className="font-semibold text-slate-800">Create runtime visit</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="rounded border px-2 py-1.5 text-sm" placeholder="Visit code (V1)" value={visitCode} onChange={(e) => setVisitCode(e.target.value)} required />
        <input className="rounded border px-2 py-1.5 text-sm" placeholder="Visit name" value={visitName} onChange={(e) => setVisitName(e.target.value)} required />
        <select className="rounded border px-2 py-1.5 text-sm" value={visitType} onChange={(e) => setVisitType(e.target.value as VisitType)}>
          {VISIT_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input className="rounded border px-2 py-1.5 text-sm" placeholder="Study day" value={studyDay} onChange={(e) => setStudyDay(e.target.value)} />
        <input className="rounded border px-2 py-1.5 text-sm" placeholder="Window before (days)" value={windowBefore} onChange={(e) => setWindowBefore(e.target.value)} />
        <input className="rounded border px-2 py-1.5 text-sm" placeholder="Window after (days)" value={windowAfter} onChange={(e) => setWindowAfter(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {['onsite', 'offsite', 'phone', 'remote'].map((mode) => (
          <label key={mode} className="flex items-center gap-1">
            <input type="checkbox" checked={modes.includes(mode)} onChange={() => toggleMode(mode)} />
            {mode}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Creating…' : 'Create visit'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
      </div>
    </form>
  )
}
