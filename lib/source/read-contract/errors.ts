/**
 * Phase 5.2B — Normalize API envelopes to UI-safe panel results.
 */

import type { ApiEnvelope } from '@/lib/api/source/types'
import type { ReadPanelError, ReadPanelResult } from '@/lib/source/read-contract/view-models'

const AUTH_CODES = new Set(['UNAUTHORIZED', 'FORBIDDEN'])
const FORBIDDEN_CODES = new Set(['FORBIDDEN', 'TENANT_SCOPE_VIOLATION', 'ORGANIZATION_MISMATCH'])

export function normalizeReadPanelError(
  envelope: ApiEnvelope<unknown>,
  panelTitle: string,
): ReadPanelError {
  const code = envelope.code ?? 'UNKNOWN'
  const messages =
    envelope.errors.length > 0
      ? envelope.errors.map((e) => e.message || e.code)
      : ['Request failed without error details.']

  return {
    code,
    title: panelTitle,
    messages,
    requestId: envelope.meta?.requestId ?? null,
    isAuthError: AUTH_CODES.has(code) || envelope.errors.some((e) => AUTH_CODES.has(e.code)),
    isForbidden:
      FORBIDDEN_CODES.has(code) || envelope.errors.some((e) => FORBIDDEN_CODES.has(e.code)),
  }
}

export function normalizeEnvelopeToPanelResult<TData, TView>(
  envelope: ApiEnvelope<TData>,
  normalize: (data: TData) => TView,
  panelTitle: string,
): ReadPanelResult<TView> {
  if (!envelope.ok || envelope.data == null) {
    return {
      status: 'error',
      error: normalizeReadPanelError(envelope, panelTitle),
    }
  }

  return {
    status: 'success',
    data: normalize(envelope.data),
    requestId: envelope.meta?.requestId,
  }
}

export function networkPanelError(panelTitle: string, message: string): ReadPanelResult<never> {
  return {
    status: 'error',
    error: {
      code: 'NETWORK_ERROR',
      title: panelTitle,
      messages: [message],
      requestId: null,
      isAuthError: false,
      isForbidden: false,
    },
  }
}
