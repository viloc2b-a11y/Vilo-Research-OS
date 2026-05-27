'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DocumentVersionSummary } from '@/lib/document-intelligence/document-version-types'
import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'

type DocumentVersionControlProps = {
  organizationId: string
  studyId: string
  intelligenceDocumentId: string
  refreshKey: number
  onChanged: () => void
}

export function DocumentVersionControl({
  organizationId,
  studyId,
  intelligenceDocumentId,
  refreshKey,
  onChanged,
}: DocumentVersionControlProps) {
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([])
  const [activeReferences, setActiveReferences] = useState<
    Array<{ domain: DocumentIntelligenceDomain; intelligenceDocumentId: string }>
  >([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        organization_id: organizationId,
        study_id: studyId,
      })
      const res = await fetch(
        `/api/document-intelligence/documents/${encodeURIComponent(intelligenceDocumentId)}/versions?${params}`,
      )
      const data = (await res.json()) as {
        versions?: DocumentVersionSummary[]
        activeReferences?: Array<{
          domain: DocumentIntelligenceDomain
          intelligenceDocumentId: string
        }>
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load versions')
      setVersions(data.versions ?? [])
      setActiveReferences(data.activeReferences ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }, [organizationId, studyId, intelligenceDocumentId])

  useEffect(() => {
    void loadVersions()
  }, [loadVersions, refreshKey])

  async function setActiveForVersion(targetDocumentId: string, domains: DocumentIntelligenceDomain[]) {
    if (domains.length === 0) return
    setActionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/document-intelligence/documents/${encodeURIComponent(targetDocumentId)}/set-active-reference`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            study_id: studyId,
            domains,
            reason: reason || null,
          }),
        },
      )
      const data = (await res.json()) as {
        evidenceSupersededCount?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to set active reference')
      setMessage(
        `Active reference updated.${data.evidenceSupersededCount ? ` ${data.evidenceSupersededCount} prior evidence item(s) marked superseded (audit retained).` : ''}`,
      )
      onChanged()
      await loadVersions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active reference')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <p className="text-xs text-slate-500">Loading document versions…</p>

  const activeDocIds = new Set(activeReferences.map((ar) => ar.intelligenceDocumentId))

  return (
    <section className="mt-4 space-y-3 rounded border border-slate-200 bg-slate-50/50 p-3">
      <div>
        <h3 className="text-xs font-semibold text-slate-800">Document version control</h3>
        <p className="mt-1 text-xs text-slate-500">
          This affects future search and evidence extraction only. It does not change runtime or
          published source. Prior versions remain audit-accessible.
        </p>
      </div>

      <label className="block text-xs text-slate-600">
        Reason (optional)
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Protocol amendment 3 effective"
        />
      </label>

      <ul className="space-y-2">
        {versions.map((version) => {
          const isActive = activeDocIds.has(version.intelligenceDocumentId)
          const domains = version.isActiveReferenceForDomains
          return (
            <li
              key={version.intelligenceDocumentId}
              className={`rounded border px-2 py-2 text-xs ${
                isActive
                  ? 'border-teal-200 bg-teal-50/50'
                  : 'border-slate-100 bg-white vilo-state-attenuated'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-800">
                    v{version.versionNumber}
                    {version.versionLabel ? ` · ${version.versionLabel}` : ''}
                  </span>
                  <span className="ml-2 text-slate-500">{version.intelligenceStatus}</span>
                </div>
                {isActive ? (
                  <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-800">
                    Active reference
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-slate-500">{version.sourceFilename}</p>
              {domains.length > 0 ? (
                <p className="mt-1 text-slate-400">
                  Active for: {domains.join(', ')}
                </p>
              ) : null}
              {version.supersededReason ? (
                <p className="mt-1 text-slate-400">Superseded: {version.supersededReason}</p>
              ) : null}
              {version.intelligenceStatus === 'ready' && !isActive ? (
                <button
                  type="button"
                  className="vilo-hover-reveal mt-2 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 opacity-100 hover:bg-slate-50 disabled:opacity-50 group-hover:opacity-100"
                  disabled={actionLoading}
                  onClick={() =>
                    void setActiveForVersion(
                      version.intelligenceDocumentId,
                      version.availableDomains.length > 0
                        ? version.availableDomains
                        : ['source_creation'],
                    )
                  }
                >
                  {actionLoading ? 'Saving…' : 'Use this version as active reference'}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      {message ? <p className="text-xs text-teal-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  )
}
