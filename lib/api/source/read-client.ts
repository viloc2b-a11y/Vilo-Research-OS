/**
 * Phase 5.2 — Server-only consumer for canonical Source read HTTP APIs.
 * Does not call RPCs or reconstruct lineage; routes remain source of truth.
 */

import { cookies, headers } from 'next/headers'
import type { ApiEnvelope } from '@/lib/api/source/types'
import type {
  FindingsListData,
  FindingsListFilters,
  HistoryData,
  ManifestData,
  ResponseSetDetailData,
} from '@/lib/api/source/read-types'

async function requestBaseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) {
    return process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000'
  }
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

async function buildCookieHeader(): Promise<string> {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

async function fetchSourceRead<T>(path: string): Promise<ApiEnvelope<T>> {
  const base = await requestBaseUrl()
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`)
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: await buildCookieHeader(),
    },
    cache: 'no-store',
  })

  let body: ApiEnvelope<T>
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      data: null,
      errors: [{ code: 'INTERNAL_ERROR', message: `Invalid JSON from ${path} (HTTP ${res.status})` }],
      warnings: [],
      meta: {
        requestId: 'client',
        timestamp: new Date().toISOString(),
        source: 'api',
        hardBlockCount: 1,
        warningCount: 0,
      },
    }
  }

  return body
}

function qs(orgId: string, extra?: Record<string, string | undefined>): string {
  const params = new URLSearchParams({ organization_id: orgId })
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== '') params.set(k, v)
    }
  }
  return params.toString()
}

export async function fetchResponseSetDetail(
  responseSetId: string,
  organizationId: string,
): Promise<ApiEnvelope<ResponseSetDetailData>> {
  return fetchSourceRead<ResponseSetDetailData>(
    `/api/source/response-set/${responseSetId}?${qs(organizationId)}`,
  )
}

export async function fetchResponseSetManifest(
  responseSetId: string,
  organizationId: string,
): Promise<ApiEnvelope<ManifestData>> {
  return fetchSourceRead<ManifestData>(
    `/api/source/response-set/${responseSetId}/manifest?${qs(organizationId)}`,
  )
}

export async function fetchResponseSetHistory(
  responseSetId: string,
  organizationId: string,
): Promise<ApiEnvelope<HistoryData>> {
  return fetchSourceRead<HistoryData>(
    `/api/source/response-set/${responseSetId}/history?${qs(organizationId)}`,
  )
}

export async function fetchResponseSetFindings(
  responseSetId: string,
  organizationId: string,
  filters: FindingsListFilters = {},
): Promise<ApiEnvelope<FindingsListData>> {
  const extra: Record<string, string | undefined> = {}
  if (filters.active_only) extra.active_only = 'true'
  if (filters.status) extra.status = filters.status
  if (filters.severity) extra.severity = filters.severity
  return fetchSourceRead<FindingsListData>(
    `/api/source/response-set/${responseSetId}/findings?${qs(organizationId, extra)}`,
  )
}

export async function fetchResponseSetReadBundle(
  responseSetId: string,
  organizationId: string,
  findingsFilters: FindingsListFilters = {},
) {
  const [detail, manifest, history, findings] = await Promise.all([
    fetchResponseSetDetail(responseSetId, organizationId),
    fetchResponseSetManifest(responseSetId, organizationId),
    fetchResponseSetHistory(responseSetId, organizationId),
    fetchResponseSetFindings(responseSetId, organizationId, findingsFilters),
  ])
  return { detail, manifest, history, findings }
}
