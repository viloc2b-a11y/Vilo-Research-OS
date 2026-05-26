'use client'

import { useState } from 'react'

export function CreateProtocolRuntimeStudyDialog(props: {
  organizationId: string
  onCreated: (studyId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [protocolNumber, setProtocolNumber] = useState('')
  const [protocolTitle, setProtocolTitle] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/protocol-intake-runtime/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: props.organizationId,
          protocol_number: protocolNumber,
          protocol_title: protocolTitle,
          sponsor_name: sponsorName || null,
        }),
      })
      const data = (await res.json()) as { study?: { id: string }; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create protocol runtime study')
      if (data.study?.id) props.onCreated(data.study.id)
      setOpen(false)
      setProtocolNumber('')
      setProtocolTitle('')
      setSponsorName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create study')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
        onClick={() => setOpen(true)}
      >
        Create protocol runtime study
      </button>
      {open ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              Protocol number
              <input
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={protocolNumber}
                onChange={(e) => setProtocolNumber(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-600">
              Sponsor name
              <input
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm text-slate-600">
            Protocol title
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={protocolTitle}
              onChange={(e) => setProtocolTitle(e.target.value)}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={loading || !protocolNumber.trim() || !protocolTitle.trim()}
              onClick={() => void create()}
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

