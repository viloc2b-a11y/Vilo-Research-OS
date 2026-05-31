'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { PatientConsentPortalModel } from '@/lib/subject/consent/types'

type PatientConsentPortalProps = {
  token: string
  model: PatientConsentPortalModel
}

const copy = {
  en: {
    title: 'Consent Session',
    verify: 'Verify Subject',
    read: 'Read Consent',
    clauses: 'Review Clauses',
    sign: 'Sign',
    confirm: 'Confirmation',
    subject: 'Subject',
    expires: 'Expires',
    continue: 'Continue',
    back: 'Back',
    signerName: 'Signer full name',
    signerType: 'Signer type',
    attest: 'I have reviewed this consent information and confirm my electronic signature.',
    submit: 'Submit Signature',
    done: 'Signature received. Thank you.',
    patient: 'Patient',
    lar: 'LAR/Guardian',
    witness: 'Witness',
  },
  es: {
    title: 'Sesión de Consentimiento',
    verify: 'Verificar Sujeto',
    read: 'Leer Consentimiento',
    clauses: 'Revisar Cláusulas',
    sign: 'Firmar',
    confirm: 'Confirmación',
    subject: 'Sujeto',
    expires: 'Expira',
    continue: 'Continuar',
    back: 'Atrás',
    signerName: 'Nombre completo del firmante',
    signerType: 'Tipo de firmante',
    attest: 'He revisado esta información de consentimiento y confirmo mi firma electrónica.',
    submit: 'Enviar Firma',
    done: 'Firma recibida. Gracias.',
    patient: 'Paciente',
    lar: 'LAR/Tutor',
    witness: 'Testigo',
  },
}

const signerOptions = [
  { value: 'patient', labelKey: 'patient' },
  { value: 'lar_guardian', labelKey: 'lar' },
  { value: 'witness', labelKey: 'witness' },
] as const

export function PatientConsentPortal({ token, model }: PatientConsentPortalProps) {
  const t = copy[model.language]
  const [step, setStep] = useState(0)
  const [signerType, setSignerType] = useState<'patient' | 'lar_guardian' | 'witness'>('patient')
  const [signerName, setSignerName] = useState('')
  const [attested, setAttested] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [pending, setPending] = useState(false)

  const steps = [t.verify, t.read, t.clauses, t.sign, t.confirm]
  const consentTitle = useMemo(() => {
    const pieces = [
      model.consentVersionLabel,
      model.masterVersionLabel,
      model.masterVersionNumber ? `v${model.masterVersionNumber}` : null,
    ].filter(Boolean)
    return pieces.join(' · ') || 'Consent'
  }, [model])

  async function submitSignature() {
    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/subject-consent/patient-session/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          signerType,
          signerName,
          attestationText: t.attest,
          signatureMethod: 'checkbox_attestation',
        }),
      })
      const result = await response.json()
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? 'Signature failed.')
      }
      setSigned(true)
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signature failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{consentTitle}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {steps.map((item, index) => (
              <span
                key={item}
                className={`rounded-full border px-3 py-1 ${index === step ? 'bg-primary text-primary-foreground' : ''}`}
              >
                {item}
              </span>
            ))}
          </CardContent>
        </Card>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        {step === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.verify}</CardTitle>
              <CardDescription>
                {t.subject}: {model.subjectIdentifier ?? 'Subject'} · {t.expires}: {new Date(model.expiresAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This consent-only link opens only the consent session associated with this subject.
              </p>
              <Button onClick={() => setStep(1)}>{t.continue}</Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.read}</CardTitle>
              <CardDescription>{model.consentType ?? 'consent'} · {model.documentStatus ?? 'available'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review the consent version, study permissions, and signature responsibilities before continuing.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>{t.back}</Button>
                <Button onClick={() => setStep(2)}>{t.continue}</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.clauses}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.clauses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extracted clauses were provided for this consent version.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {model.clauses.map((clause) => (
                    <li key={clause.id} className="rounded-md border p-3">
                      <div className="font-medium">{clause.clauseType.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-muted-foreground">
                        {clause.clauseStatus}
                        {clause.requiresOptionalPermission ? ' · optional permission' : ''}
                        {clause.requiresReconsentOnChange ? ' · reconsent if changed' : ''}
                      </div>
                      {clause.extractedText ? <p className="mt-2 text-xs text-muted-foreground">{clause.extractedText}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>{t.back}</Button>
                <Button onClick={() => setStep(3)}>{t.continue}</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.sign}</CardTitle>
              <CardDescription>
                Existing signatures: {model.existingSignatures.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm font-medium">
                {t.signerType}
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={signerType}
                  onChange={(event) => setSignerType(event.target.value as typeof signerType)}
                >
                  {signerOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t[item.labelKey]}
                    </option>
                  ))}
                </select>
              </label>
              <Input value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder={t.signerName} />
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input className="mt-1" type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />
                <span>{t.attest}</span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>{t.back}</Button>
                <Button onClick={submitSignature} disabled={pending || !signerName.trim() || !attested}>
                  {t.submit}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.confirm}</CardTitle>
              <CardDescription>{signed ? t.done : 'Session complete.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Token hint: {model.tokenHint} · status: signed
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
