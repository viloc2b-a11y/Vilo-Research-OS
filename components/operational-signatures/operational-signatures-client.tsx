'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  OPERATIONAL_SIGNATURE_WARNING,
  type OperationalSignatureEventRow,
  type OperationalSignatureRequestRow,
  type OperationalSignatureRow,
} from '@/lib/operational-signatures/operational-signature-types'

type StudyOption = { id: string; name: string }
type AssignedReviewRequest = {
  request_id: string
  document_id: string
  request_type: string
  message: string | null
  due_date: string | null
  status: string
  created_at: string
}

function displayValue(value: string | null) {
  return value ? value.slice(0, 8) : 'None'
}

export function OperationalSignaturesClient({
  organizationId,
  studies,
  initialStudyId = null,
}: {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<OperationalSignatureRequestRow[]>([])
  const [reviewRequests, setReviewRequests] = useState<AssignedReviewRequest[]>([])
  const [events, setEvents] = useState<OperationalSignatureEventRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [lastSignature, setLastSignature] = useState<OperationalSignatureRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const studyIds = useMemo(() => new Set(studies.map((study) => study.id)), [studies])
  const studyId = useMemo(() => {
    const fromQuery = searchParams.get('study_id') ?? initialStudyId ?? ''
    return fromQuery && studyIds.has(fromQuery) ? fromQuery : ''
  }, [initialStudyId, searchParams, studyIds])

  const selectedRequest = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null

  const loadPending = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ organization_id: organizationId })
      if (studyId) params.set('study_id', studyId)
      const res = await fetch(`/api/operational-signatures/pending?${params.toString()}`)
      const data = (await res.json()) as {
        requests?: OperationalSignatureRequestRow[]
        reviewRequests?: AssignedReviewRequest[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load pending signatures')
      setRequests(data.requests ?? [])
      setReviewRequests(data.reviewRequests ?? [])
    } catch (err) {
      setRequests([])
      setReviewRequests([])
      setError(err instanceof Error ? err.message : 'Failed to load pending signatures')
    } finally {
      setLoading(false)
    }
  }, [organizationId, studyId])

  const loadAuditTrail = useCallback(async () => {
    if (!selectedRequest) {
      setEvents([])
      return
    }
    try {
      const params = new URLSearchParams({ organization_id: organizationId })
      if (studyId) params.set('study_id', studyId)
      const res = await fetch(
        `/api/operational-signatures/${selectedRequest.id}/events?${params.toString()}`,
      )
      const data = (await res.json()) as {
        events?: OperationalSignatureEventRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load signature audit trail')
      setEvents(data.events ?? [])
    } catch (err) {
      setEvents([])
      setError(err instanceof Error ? err.message : 'Failed to load signature audit trail')
    }
  }, [organizationId, selectedRequest, studyId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPending()
  }, [loadPending, refreshKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAuditTrail()
  }, [loadAuditTrail])

  function onStudyChange(nextStudyId: string) {
    setSelectedId(null)
    setConfirmed(false)
    setLastSignature(null)
    const params = new URLSearchParams(searchParams.toString())
    if (nextStudyId) params.set('study_id', nextStudyId)
    else params.delete('study_id')
    router.replace(
      params.toString()
        ? `/operational-signatures?${params.toString()}`
        : '/operational-signatures',
      { scroll: false },
    )
  }

  async function signSelected() {
    if (!selectedRequest) return
    setActionLoading(true)
    setError(null)
    setMessage(null)
    setLastSignature(null)
    try {
      const res = await fetch(`/api/operational-signatures/${selectedRequest.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          explicit_user_action: true,
          confirmation_statement: OPERATIONAL_SIGNATURE_WARNING,
        }),
      })
      const data = (await res.json()) as {
        signature?: OperationalSignatureRow
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Signature failed')
      setLastSignature(data.signature ?? null)
      setMessage('Electronic signature recorded in the audit trail.')
      setConfirmed(false)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signature failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function transitionSignature(requestId: string, action: 'reject' | 'rescind', reason: string) {
    setActionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/operational-signatures/${requestId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          action,
          reason,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to update signature request')
      setMessage(`Signature request ${action === 'reject' ? 'rejected' : 'rescinded'}.`)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update signature request')
    } finally {
      setActionLoading(false)
    }
  }

  async function transitionReview(requestId: string, status: string, reason?: string) {
    setActionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/operational-signatures/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          request_id: requestId,
          status,
          reason,
          notify_requester: status === 'Rejected',
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to update review request')
      setMessage(`Review request ${status.toLowerCase()}.`)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review request')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          K5 · Operational eSignature Runtime
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Operational eSignature
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Pending Signatures for clinical execution artifacts. Evidence signoff remains separate
          from operational signature authority.
        </p>
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Signature records append to the audit trail only. They do not change evidence state,
          reconciliation, published source, runtime execution, or locked snapshots.
        </p>
      </header>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Study scope
          <select
            className="mt-2 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-2 text-sm"
            value={studyId}
            onChange={(event) => onStudyChange(event.target.value)}
          >
            <option value="">All accessible studies</option>
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-800">Pending Signatures</h2>
          </div>
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No pending signatures found.</p>
          ) : (
            <ul className="max-h-[58vh] overflow-y-auto">
              {requests.map((request) => (
                <li key={request.id}>
                  <button
                    type="button"
                    className={`w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50 ${
                      selectedRequest?.id === request.id ? 'bg-teal-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedId(request.id)
                      setConfirmed(false)
                      setLastSignature(null)
                    }}
                  >
                    <span className="block text-sm font-medium text-slate-800">
                      {request.artifactType}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Signature Meaning: {request.signatureMeaning} · role {request.requiredRole}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-800">Assigned Reviews</h2>
          </div>
          {reviewRequests.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No assigned reviews found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reviewRequests.map((request) => (
                <li key={request.request_id} className="space-y-2 p-3 text-sm">
                  <p className="font-medium text-slate-800">{request.request_type} · {request.status}</p>
                  <p className="text-xs text-slate-500">{request.message ?? 'No message'}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded border px-2 py-1 text-xs" disabled={actionLoading} onClick={() => void transitionReview(request.request_id, 'Viewed')}>
                      Mark viewed
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" disabled={actionLoading} onClick={() => void transitionReview(request.request_id, 'Reviewed')}>
                      Mark reviewed
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" disabled={actionLoading} onClick={() => {
                      const reason = window.prompt('Rejection reason')
                      if (reason) void transitionReview(request.request_id, 'Rejected', reason)
                    }}>
                      Reject
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" disabled={actionLoading} onClick={() => {
                      const reason = window.prompt('Rescind reason')
                      if (reason) void transitionReview(request.request_id, 'Rescinded', reason)
                    }}>
                      Rescind
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          {!selectedRequest ? (
            <p className="text-sm text-slate-500">Select a pending signature request.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Review Before Signing</h2>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Artifact
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {selectedRequest.artifactType} · {displayValue(selectedRequest.artifactId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Signature Meaning
                    </dt>
                    <dd className="mt-1 text-slate-800">{selectedRequest.signatureMeaning}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Required role
                    </dt>
                    <dd className="mt-1 text-slate-800">{selectedRequest.requiredRole}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Visit
                    </dt>
                    <dd className="mt-1 text-slate-800">{displayValue(selectedRequest.visitId)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <label className="flex gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>{OPERATIONAL_SIGNATURE_WARNING}</span>
                </label>
                <button
                  type="button"
                  className="mt-3 rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={actionLoading || !confirmed}
                  onClick={() => void signSelected()}
                >
                  {actionLoading ? 'Signing...' : 'Sign Electronically'}
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    disabled={actionLoading}
                    onClick={() => {
                      const reason = window.prompt('Rejection reason')
                      if (reason) void transitionSignature(selectedRequest.id, 'reject', reason)
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    disabled={actionLoading}
                    onClick={() => {
                      const reason = window.prompt('Rescind reason')
                      if (reason) void transitionSignature(selectedRequest.id, 'rescind', reason)
                    }}
                  >
                    Rescind
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-800">Signature Audit Trail</h2>
                {events.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No audit events loaded.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                    {events.map((event) => (
                      <li key={event.id} className="p-3 text-sm">
                        <p className="font-medium text-slate-800">{event.eventType}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(event.occurredAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {lastSignature ? (
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  <p>Signed artifact hash</p>
                  <p className="break-all font-mono">{lastSignature.signedArtifactHash}</p>
                </div>
              ) : null}
              {message ? <p className="text-sm text-teal-700">{message}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
