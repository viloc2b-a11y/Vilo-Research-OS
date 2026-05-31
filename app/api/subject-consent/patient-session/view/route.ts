import { NextRequest, NextResponse } from 'next/server'
import { viewPatientConsentSessionAction } from '@/lib/subject/consent/actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { accessToken?: string }
    const result = await viewPatientConsentSessionAction({
      accessToken: body.accessToken ?? '',
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Patient consent session failed.' },
      { status: 400 },
    )
  }
}
