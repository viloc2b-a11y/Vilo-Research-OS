/**
 * Phase 5.2D — Server-only consumer for Source write HTTP APIs (open, save-draft, submit).
 */

import { cookies, headers } from 'next/headers'
import type { ApiEnvelope } from '@/lib/api/source/types'
import type {
  AddendumRequestBody,
  CorrectRequestBody,
  FindingActionRequestBody,
  OpenRequestBody,
  SaveDraftRequestBody,
  SubmitRequestBody,
} from '@/lib/api/source/validate'

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

async function postSourceWrite<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiEnvelope<T>> {
  const base = await requestBaseUrl()
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: await buildCookieHeader(),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  try {
    return (await res.json()) as ApiEnvelope<T>
  } catch {
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      data: null,
      errors: [
        {
          code: 'INTERNAL_ERROR',
          message: `Invalid JSON from ${path} (HTTP ${res.status})`,
        },
      ],
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
}

export type OpenResponseSetData = {
  source_response_set_id: string
  created?: boolean
}

export async function postOpenResponseSet(
  body: OpenRequestBody,
): Promise<ApiEnvelope<OpenResponseSetData>> {
  return postSourceWrite<OpenResponseSetData>('/api/source/response-set/open', body)
}

export async function postSaveDraft(
  body: SaveDraftRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/response-set/save-draft', body)
}

export async function postSubmitResponseSet(
  body: SubmitRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/response-set/submit', body)
}

export async function postCorrectResponse(
  body: CorrectRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/response/correct', body)
}

export async function postAddendum(
  body: AddendumRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/response-set/addendum', body)
}

export async function postAcknowledgeFinding(
  body: FindingActionRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/findings/acknowledge', {
    organization_id: body.organization_id,
    finding_id: body.finding_id,
    ...(body.comment ? { comment: body.comment } : {}),
  })
}

export async function postResolveFinding(
  body: FindingActionRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/findings/resolve', {
    organization_id: body.organization_id,
    finding_id: body.finding_id,
    resolution_text: body.comment ?? '',
  })
}

export async function postWaiveFinding(
  body: FindingActionRequestBody,
): Promise<ApiEnvelope<unknown>> {
  return postSourceWrite<unknown>('/api/source/findings/waive', {
    organization_id: body.organization_id,
    finding_id: body.finding_id,
    waiver_reason: body.comment ?? '',
  })
}
