import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNATURE_PIN_ITERATIONS = 210000
const SIGNATURE_PIN_KEY_LENGTH = 32
const SIGNATURE_PIN_DIGITS = 6
const SIGNATURE_PIN_MAX_FAILURES = 5

export type SignatureCredentialRow = {
  credentialId: string
  userId: string
  signaturePinHash: string
  pinCreatedAt: string
  pinUpdatedAt: string
  failedAttempts: number
  lockedUntil: string | null
  requiresReset: boolean
  active: boolean
}

export type SignatureCredentialStatus = {
  hasCredential: boolean
  active: boolean
  requiresReset: boolean
  lockedUntil: string | null
  failedAttempts: number
  pinCreatedAt: string | null
  pinUpdatedAt: string | null
  needsSetup: boolean
}

function encodeHash(salt: string, hash: Buffer) {
  return `pbkdf2_sha256$${SIGNATURE_PIN_ITERATIONS}$${salt}$${hash.toString('hex')}`
}

function decodeHash(value: string): { salt: string; iterations: number; hashHex: string } | null {
  const [algo, iterationsRaw, salt, hashHex] = value.split('$')
  if (algo !== 'pbkdf2_sha256' || !salt || !hashHex) return null
  const iterations = Number(iterationsRaw)
  if (!Number.isFinite(iterations) || iterations <= 0) return null
  return { salt, iterations, hashHex }
}

export function normalizeSignaturePin(pin: string): string {
  return pin.replace(/\s+/g, '').trim()
}

export function isValidSignaturePin(pin: string): boolean {
  const normalized = normalizeSignaturePin(pin)
  return normalized.length === SIGNATURE_PIN_DIGITS && /^\d+$/.test(normalized)
}

export async function hashSignaturePin(pin: string): Promise<string> {
  const normalized = normalizeSignaturePin(pin)
  if (!isValidSignaturePin(normalized)) {
    throw new Error('Signature PIN must be exactly 6 digits.')
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(
      normalized,
      salt,
      SIGNATURE_PIN_ITERATIONS,
      SIGNATURE_PIN_KEY_LENGTH,
      'sha256',
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      },
    )
  })
  return encodeHash(salt, derived)
}

export async function verifySignaturePin(pin: string, pinHash: string): Promise<boolean> {
  const normalized = normalizeSignaturePin(pin)
  const decoded = decodeHash(pinHash)
  if (!decoded || !isValidSignaturePin(normalized)) return false
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(
      normalized,
      decoded.salt,
      decoded.iterations,
      SIGNATURE_PIN_KEY_LENGTH,
      'sha256',
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      },
    )
  })
  const current = Buffer.from(decoded.hashHex, 'hex')
  return current.length === derived.length && crypto.timingSafeEqual(current, derived)
}

function mapCredential(row: Record<string, unknown>): SignatureCredentialRow {
  return {
    credentialId: String(row.credential_id),
    userId: String(row.user_id),
    signaturePinHash: String(row.signature_pin_hash),
    pinCreatedAt: String(row.pin_created_at),
    pinUpdatedAt: String(row.pin_updated_at),
    failedAttempts: Number(row.failed_attempts ?? 0),
    lockedUntil: row.locked_until ? String(row.locked_until) : null,
    requiresReset: row.requires_reset === true,
    active: row.active !== false,
  }
}

export async function loadSignatureCredential(
  supabase: SupabaseClient,
  userId: string,
): Promise<SignatureCredentialRow | null> {
  const { data, error } = await supabase
    .from('signature_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCredential(data as Record<string, unknown>) : null
}

export async function loadSignatureCredentialStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<SignatureCredentialStatus> {
  const credential = await loadSignatureCredential(supabase, userId)
  return {
    hasCredential: Boolean(credential),
    active: credential?.active ?? false,
    requiresReset: credential?.requiresReset ?? false,
    lockedUntil: credential?.lockedUntil ?? null,
    failedAttempts: credential?.failedAttempts ?? 0,
    pinCreatedAt: credential?.pinCreatedAt ?? null,
    pinUpdatedAt: credential?.pinUpdatedAt ?? null,
    needsSetup: !credential || !credential.active,
  }
}

export async function upsertSignatureCredential(
  supabase: SupabaseClient,
  input: {
    userId: string
    pin: string
    resetExisting?: boolean
  },
): Promise<SignatureCredentialRow> {
  const hashedPin = await hashSignaturePin(input.pin)
  const existing = await loadSignatureCredential(supabase, input.userId)
  const now = new Date().toISOString()
  const payload = {
    user_id: input.userId,
    signature_pin_hash: hashedPin,
    pin_created_at: existing?.pinCreatedAt ?? now,
    pin_updated_at: now,
    failed_attempts: 0,
    locked_until: null,
    requires_reset: false,
    active: true,
    metadata: {
      ...(existing ? { replaced_previous_pin: true } : {}),
      reset_existing: Boolean(input.resetExisting),
    },
  }

  const { data, error } = existing
    ? await supabase
        .from('signature_credentials')
        .update(payload)
        .eq('user_id', input.userId)
        .select('*')
        .single()
    : await supabase.from('signature_credentials').insert(payload).select('*').single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to save signature credential.')
  return mapCredential(data as Record<string, unknown>)
}

export async function recordSignaturePinFailure(
  supabase: SupabaseClient,
  input: { userId: string; reason: string },
): Promise<SignatureCredentialRow | null> {
  const existing = await loadSignatureCredential(supabase, input.userId)
  if (!existing) return null
  const failedAttempts = existing.failedAttempts + 1
  const locked = failedAttempts >= SIGNATURE_PIN_MAX_FAILURES
  const lockedUntil = locked
    ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    : existing.lockedUntil
  const { data, error } = await supabase
    .from('signature_credentials')
    .update({
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
      requires_reset: locked || existing.requiresReset,
      pin_updated_at: existing.pinUpdatedAt,
    })
    .eq('user_id', input.userId)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to update signature credential.')

  return mapCredential(data as Record<string, unknown>)
}

export async function resetSignatureCredentialFailures(
  supabase: SupabaseClient,
  userId: string,
): Promise<SignatureCredentialRow | null> {
  const existing = await loadSignatureCredential(supabase, userId)
  if (!existing) return null
  const { data, error } = await supabase
    .from('signature_credentials')
    .update({
      failed_attempts: 0,
      locked_until: null,
      requires_reset: false,
      active: true,
      pin_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to reset signature credential.')
  return mapCredential(data as Record<string, unknown>)
}
