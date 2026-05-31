import { NextRequest, NextResponse } from 'next/server'
import { recordPatientConsentSignatureAction } from '@/lib/subject/consent/actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      accessToken?: string
      signerType?: 'patient' | 'lar_guardian' | 'witness'
      signerName?: string
      attestationText?: string
      signatureMethod?: 'typed_attestation' | 'drawn_signature' | 'checkbox_attestation'
    }
    const result = await recordPatientConsentSignatureAction({
      accessToken: body.accessToken ?? '',
      signerType: body.signerType ?? 'patient',
      signerName: body.signerName ?? '',
      attestationText: body.attestationText ?? '',
      signatureMethod: body.signatureMethod,
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Patient consent signature failed.' },
      { status: 400 },
    )
  }
}
