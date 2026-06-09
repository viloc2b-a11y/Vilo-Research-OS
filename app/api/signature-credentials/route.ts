import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  isValidSignaturePin,
  loadSignatureCredential,
  loadSignatureCredentialStatus,
  recordSignaturePinFailure,
  resetSignatureCredentialFailures,
  upsertSignatureCredential,
  verifySignaturePin,
} from '@/lib/operational-signatures/signature-credentials'
import { getSessionUser } from '@/lib/auth/session'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  try {
    const status = await loadSignatureCredentialStatus(supabase, user.id)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load signature credential'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    pin?: string
    confirm_pin?: string
    current_pin?: string
    action?: 'set' | 'reset'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const pin = body.pin?.trim() ?? ''
  const confirmPin = body.confirm_pin?.trim() ?? ''
  const currentPin = body.current_pin?.trim() ?? ''

  if (!pin || !confirmPin) {
    return NextResponse.json({ error: 'pin and confirm_pin are required' }, { status: 400 })
  }
  if (pin !== confirmPin) {
    return NextResponse.json({ error: 'PIN confirmation does not match' }, { status: 400 })
  }
  if (!isValidSignaturePin(pin)) {
    return NextResponse.json({ error: 'Signature PIN must be exactly 6 digits.' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const existing = await loadSignatureCredential(supabase, user.id)

  if (existing && !existing.requiresReset && !currentPin) {
    return NextResponse.json(
      { error: 'Current PIN is required to update your signature credential.' },
      { status: 400 },
    )
  }

  if (existing && currentPin) {
    const ok = await verifySignaturePin(currentPin, existing.signaturePinHash)
    if (!ok) {
      await recordSignaturePinFailure(supabase, {
        userId: user.id,
        reason: 'Invalid current signature PIN.',
      })
      return NextResponse.json({ error: 'Invalid current signature PIN.' }, { status: 409 })
    }
    await resetSignatureCredentialFailures(supabase, user.id)
  }

  try {
    await upsertSignatureCredential(supabase, {
      userId: user.id,
      pin,
      resetExisting: body.action === 'reset' || Boolean(existing),
    })
    const status = await loadSignatureCredentialStatus(supabase, user.id)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save signature credential'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
