'use client'

import { useEffect, useState } from 'react'
import type {
  RuntimeSourcePackagePublicationRow,
  RuntimeSourcePublicationEventRow,
  RuntimeSourceSignaturePlaceholderRow,
} from '@/lib/runtime-source-publication/runtime-source-publication-types'
import { PublicationPackageSelector } from './publication-package-selector'
import { PublishSourcePackageButton } from './publish-source-package-button'
import { SignaturePlaceholderList } from './signature-placeholder-list'
import { SourcePublicationDetail } from './source-publication-detail'
import { SourcePublicationList } from './source-publication-list'

type StudyOption = { id: string; name: string }

export function RuntimeSourcePublicationClient(props: {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
}) {
  const preselected =
    props.initialStudyId && props.studies.some((s) => s.id === props.initialStudyId)
      ? props.initialStudyId
      : null
  const [studyId, setStudyId] = useState(preselected ?? props.studies[0]?.id ?? '')
  const [sourcePackageId, setSourcePackageId] = useState('')
  const [placeholders, setPlaceholders] = useState<RuntimeSourceSignaturePlaceholderRow[]>([])
  const [publications, setPublications] = useState<RuntimeSourcePackagePublicationRow[]>([])
  const [selectedPublicationId, setSelectedPublicationId] = useState<string | null>(null)
  const [publicationDetail, setPublicationDetail] = useState<{
    publication: RuntimeSourcePackagePublicationRow
    events: RuntimeSourcePublicationEventRow[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studyId) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/runtime-source-publication/publications?organization_id=${encodeURIComponent(props.organizationId)}&study_id=${encodeURIComponent(studyId)}`,
        )
        const data = (await res.json()) as { publications?: RuntimeSourcePackagePublicationRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to list publications')
        if (!cancelled) {
          setPublications(data.publications ?? [])
          setSelectedPublicationId((current) => current ?? data.publications?.[0]?.id ?? null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to list publications')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.organizationId, studyId, refreshKey])

  useEffect(() => {
    let cancelled = false
    async function loadPlaceholders(activePackageId: string) {
      setError(null)
      try {
        const res = await fetch(
          `/api/runtime-source-publication/signature-placeholders?organization_id=${encodeURIComponent(props.organizationId)}&source_package_id=${encodeURIComponent(activePackageId)}`,
        )
        const data = (await res.json()) as { placeholders?: RuntimeSourceSignaturePlaceholderRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to list placeholders')
        if (!cancelled) setPlaceholders(data.placeholders ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to list placeholders')
      }
    }
    if (!sourcePackageId) return
    void loadPlaceholders(sourcePackageId)
    return () => {
      cancelled = true
    }
  }, [props.organizationId, sourcePackageId, refreshKey])

  useEffect(() => {
    let cancelled = false
    async function loadDetail(publicationId: string) {
      try {
        const res = await fetch(
          `/api/runtime-source-publication/publications/${encodeURIComponent(publicationId)}?organization_id=${encodeURIComponent(props.organizationId)}`,
        )
        const data = (await res.json()) as {
          publication?: RuntimeSourcePackagePublicationRow
          events?: RuntimeSourcePublicationEventRow[]
          error?: string
        }
        if (!res.ok) throw new Error(data.error || 'Failed to load publication detail')
        if (!cancelled && data.publication) {
          setPublicationDetail({ publication: data.publication, events: data.events ?? [] })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load publication detail')
      }
    }
    if (!selectedPublicationId) return
    void loadDetail(selectedPublicationId)
    return () => {
      cancelled = true
    }
  }, [props.organizationId, selectedPublicationId, refreshKey])

  return (
    <div className="space-y-6">
      <PublicationPackageSelector
        organizationId={props.organizationId}
        studies={props.studies}
        studyId={studyId}
        onStudyId={(id) => {
          setStudyId(id)
          setSourcePackageId('')
          setPlaceholders([])
          setSelectedPublicationId(null)
          setPublicationDetail(null)
          setRefreshKey((v) => v + 1)
        }}
        selectedPackageId={sourcePackageId}
        onPackageId={(id) => {
          setSourcePackageId(id)
          setPlaceholders([])
        }}
      />

      <div className="flex flex-wrap gap-3">
        <PublishSourcePackageButton
          organizationId={props.organizationId}
          studyId={studyId}
          sourcePackageId={sourcePackageId}
          disabled={!studyId || !sourcePackageId}
          onPublished={() => setRefreshKey((v) => v + 1)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading publications…</p> : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Signature placeholders</h2>
        <SignaturePlaceholderList placeholders={placeholders} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Published source versions</h2>
          <SourcePublicationList
            publications={publications}
            selectedId={selectedPublicationId}
            onSelect={(id) => {
              setSelectedPublicationId(id)
              setPublicationDetail(null)
            }}
          />
        </section>
        <section>
          {publicationDetail ? (
            <SourcePublicationDetail publication={publicationDetail.publication} events={publicationDetail.events} />
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
              Select a published source version to view details.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

