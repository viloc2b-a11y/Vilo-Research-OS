/**
 * Phase 5.1B — shared helpers for Source API runtime E2E.
 */

import { createBrowserClient } from '@supabase/ssr'
import { serializeCookieHeader } from '@supabase/ssr'

export const SYNTHETIC = {
  userA: { email: 'synthetic.staff.a@vilo-os.staging', password: 'SyntheticViloOs!2026A' },
  userB: { email: 'synthetic.staff.b@vilo-os.staging', password: 'SyntheticViloOs!2026B' },
  userC: {
    email: 'synthetic.staff.c.orga.only@vilo-os.staging',
    password: 'SyntheticViloOs!2026C',
  },
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function stepRecord(id, status, fields = {}) {
  return {
    step: id,
    id,
    status,
    detail: String(fields.detail ?? ''),
    route: fields.route ?? null,
    rpc: fields.rpc ?? null,
    http_status: fields.http_status ?? null,
    expected: fields.expected ?? null,
    actual: fields.actual ?? null,
    key_ids: fields.key_ids ?? {},
    errors: fields.errors ?? null,
    ...fields.extra,
  }
}

/**
 * Assert standard ApiEnvelope shape from Next.js Source routes.
 */
export function assertApiEnvelope(body, options = {}) {
  const issues = []
  const { expectedRpc, requireOk = false } = options

  if (!body || typeof body !== 'object') {
    return { ok: false, issues: ['body must be a JSON object'], body }
  }

  for (const key of ['ok', 'code', 'data', 'errors', 'warnings', 'meta']) {
    if (!(key in body)) issues.push(`missing top-level field: ${key}`)
  }

  if (typeof body.ok !== 'boolean') issues.push('ok must be boolean')
  if (!Array.isArray(body.errors)) issues.push('errors must be an array')
  if (!Array.isArray(body.warnings)) issues.push('warnings must be an array')

  if (!body.meta || typeof body.meta !== 'object') {
    issues.push('meta must be an object')
  } else {
    if (typeof body.meta.requestId !== 'string' || !body.meta.requestId.trim()) {
      issues.push('meta.requestId must be a non-empty string')
    }
    if (expectedRpc && body.meta.rpc !== expectedRpc) {
      issues.push(`meta.rpc expected ${expectedRpc}, got ${body.meta.rpc ?? 'null'}`)
    }
    if (body.meta.source !== 'api') {
      issues.push(`meta.source expected api, got ${body.meta.source ?? 'null'}`)
    }
  }

  if (requireOk && body.ok !== true) {
    issues.push(`expected ok=true, got ok=${body.ok} code=${body.code}`)
  }

  return { ok: issues.length === 0, issues, body }
}

export async function signInForCookieHeader(supabaseUrl, anonKey, { email, password }) {
  const jar = []
  const supabase = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return [...jar]
      },
      setAll(items) {
        jar.length = 0
        jar.push(...items)
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(error?.message ?? 'sign-in failed')
  }

  const cookieHeader = jar
    .filter((c) => c.value)
    .map((c) => serializeCookieHeader(c.name, c.value, c.options ?? {}))
    .join('; ')

  return { supabase, session: data.session, cookieHeader, jar }
}

export async function apiFetch(baseUrl, path, options = {}) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) }
  if (options.cookieHeader) headers.Cookie = options.cookieHeader
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const timeoutMs = options.timeoutMs ?? 60_000
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { _raw: text }
  }

  return { res, json, httpStatus: res.status }
}

export function historyEvents(body) {
  const events = body?.data?.events
  return Array.isArray(events) ? events : []
}

export function historyFingerprint(body) {
  const events = historyEvents(body)
  return JSON.stringify(
    events.map((e) => ({
      occurred_at: e.occurred_at,
      event_kind: e.event_kind,
      actor_user_id: e.actor_user_id,
      payload_keys: e.payload && typeof e.payload === 'object' ? Object.keys(e.payload).sort() : [],
    })),
  )
}

export function isChronological(events) {
  if (events.length < 2) return true
  let prev = events[0]?.occurred_at ? Date.parse(events[0].occurred_at) : 0
  for (let i = 1; i < events.length; i++) {
    const cur = events[i]?.occurred_at ? Date.parse(events[i].occurred_at) : 0
    if (cur < prev) return false
    prev = cur
  }
  return true
}

export function responseValueSnapshot(row) {
  return JSON.stringify({
    value_text: row?.value_text ?? null,
    value_number: row?.value_number ?? null,
    value_boolean: row?.value_boolean ?? null,
    value_date: row?.value_date ?? null,
    value_datetime: row?.value_datetime ?? null,
  })
}

export function valueForWidget(widgetHint) {
  const hint = String(widgetHint ?? 'text').toLowerCase()
  if (hint.includes('integer') || hint === 'number') return { value_number: 42 }
  if (hint === 'boolean') return { value_boolean: true }
  if (hint === 'date') return { value_date: '2026-05-16' }
  if (hint.includes('datetime')) return { value_datetime: '2026-05-16T12:00:00Z' }
  return { value_text: 'e2e-staging-value' }
}

export function correctionValueForWidget(widgetHint) {
  const base = valueForWidget(widgetHint)
  if (base.value_number !== undefined) return { value_number: 99 }
  if (base.value_boolean !== undefined) return { value_boolean: false }
  if (base.value_date !== undefined) return { value_date: '2026-06-01' }
  if (base.value_datetime !== undefined) return { value_datetime: '2026-06-01T15:00:00Z' }
  return { value_text: 'e2e-corrected-value' }
}

export function secondCorrectionValueForWidget(widgetHint) {
  const base = correctionValueForWidget(widgetHint)
  if (base.value_number !== undefined) return { value_number: 100 }
  if (base.value_boolean !== undefined) return { value_boolean: true }
  if (base.value_date !== undefined) return { value_date: '2026-06-15' }
  if (base.value_datetime !== undefined) return { value_datetime: '2026-06-15T16:00:00Z' }
  return { value_text: 'e2e-corrected-value-2' }
}
