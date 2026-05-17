/**
 * Phase 5.1A — HTTP response helpers for Source API routes.
 */

import { NextResponse } from 'next/server'
import { httpStatusForEnvelope } from '@/lib/api/source/errors'
import type { ApiEnvelope } from '@/lib/api/source/types'

export function jsonEnvelope<T>(envelope: ApiEnvelope<T | null>, statusOverride?: number): NextResponse {
  const status = statusOverride ?? httpStatusForEnvelope(envelope.ok, envelope.code)
  return NextResponse.json(envelope, { status })
}
