export type ConsentRecordValidationInput = {
  libraryStatus?: string | null
  libraryReviewStatus?: string | null
  completionMethod?: string | null
  consentStatus?: string | null
  consentDateTime?: string | null
  subjectSignatureRequired?: boolean
  coordinatorSignatureRequired?: boolean
  piSignatureRequired?: boolean
  witnessSignatureRequired?: boolean
  larSignatureRequired?: boolean
  subjectSignedAt?: string | null
  coordinatorSignedAt?: string | null
  piSignedAt?: string | null
  witnessSignedAt?: string | null
  larSignedAt?: string | null
  participantCopyProvided?: boolean
  evidenceCount?: number
  consentDocumentUploadPending?: boolean
  activeVersionUsed?: boolean
  trainingValid?: boolean
  delegationValid?: boolean
  reconsentStatus?: string | null
  reconsentActionRequired?: boolean
}

export type ConsentRecordValidationResult = {
  is_complete: boolean
  blocking_issues: string[]
  warnings: string[]
  missing_fields: string[]
  recommended_action: string
}

const ACTIVE_LIBRARY_STATUSES = new Set(['approved', 'active'])
const COMPLETE_CONSENT_STATUSES = new Set(['consented', 'active', 'completed', 'withdrawn', 'expired'])

export function validateConsentRecord(
  input: ConsentRecordValidationInput,
): ConsentRecordValidationResult {
  const blocking_issues: string[] = []
  const warnings: string[] = []
  const missing_fields: string[] = []

  const libraryStatus = (input.libraryStatus ?? '').toLowerCase()
  const libraryReviewStatus = (input.libraryReviewStatus ?? '').toLowerCase()
  const consentStatus = (input.consentStatus ?? '').toLowerCase()
  const completionMethod = (input.completionMethod ?? '').toLowerCase()

  if (!input.delegationValid) {
    blocking_issues.push('User is not delegated or training is not valid for consent activity.')
  }

  if (input.trainingValid === false) {
    blocking_issues.push('Required consent training is not valid.')
  }

  if (input.activeVersionUsed === false) {
    blocking_issues.push('An inactive or unapproved consent version was selected.')
  }

  if (!ACTIVE_LIBRARY_STATUSES.has(libraryStatus) && libraryStatus) {
    blocking_issues.push('Consent template version is not active or approved.')
  } else if (!libraryStatus && libraryReviewStatus && libraryReviewStatus !== 'reviewed') {
    warnings.push('Consent template version has not been fully reviewed.')
  }

  if (!input.consentDateTime) {
    missing_fields.push('consentDateTime')
    if (consentStatus !== 'not_started') {
      blocking_issues.push('Consent date/time is missing.')
    }
  }

  if (input.subjectSignatureRequired !== false && !input.subjectSignedAt) {
    missing_fields.push('subjectSignedAt')
    blocking_issues.push('Subject signature is missing.')
  }

  if (input.coordinatorSignatureRequired !== false && !input.coordinatorSignedAt) {
    missing_fields.push('coordinatorSignedAt')
    blocking_issues.push('Person obtaining consent signature is missing.')
  }

  if (input.piSignatureRequired && !input.piSignedAt) {
    missing_fields.push('piSignedAt')
    blocking_issues.push('PI/Sub-I signature is required but missing.')
  } else if (!input.piSignatureRequired && !input.piSignedAt) {
    warnings.push('PI/Sub-I signature not present, but not required.')
  }

  if (input.witnessSignatureRequired && !input.witnessSignedAt) {
    missing_fields.push('witnessSignedAt')
    blocking_issues.push('Witness signature is required but missing.')
  }

  if (input.larSignatureRequired && !input.larSignedAt) {
    missing_fields.push('larSignedAt')
    blocking_issues.push('LAR signature is required but missing.')
  }

  if (input.evidenceCount === 0 || input.evidenceCount == null) {
    if (completionMethod === 'paper_signed_attested' || completionMethod === 'imported_legacy') {
      warnings.push('Evidence file is pending upload, but paper consent can remain operationally valid.')
    } else if (completionMethod === 'electronic_patient_signature' || completionMethod === 'external_platform') {
      blocking_issues.push('Consent evidence file is missing.')
    }
  }

  if (input.consentDocumentUploadPending) {
    warnings.push('Consent document upload is pending follow-up.')
  }

  if (input.participantCopyProvided === false) {
    warnings.push('Participant copy is not documented.')
  }

  if (input.reconsentActionRequired && input.reconsentStatus && ['pending', 'overdue'].includes(input.reconsentStatus)) {
    warnings.push(
      input.reconsentStatus === 'overdue'
        ? 'Reconsent is overdue and needs immediate follow-up.'
        : 'Reconsent evaluation is pending.',
    )
  }

  if (!COMPLETE_CONSENT_STATUSES.has(consentStatus) && consentStatus) {
    warnings.push(`Current consent status is ${consentStatus}.`)
  }

  const is_complete = blocking_issues.length === 0
  const recommended_action = blocking_issues[0]
    ?? warnings[0]
    ?? 'Consent record is complete and ready for downstream gates.'

  return {
    is_complete,
    blocking_issues,
    warnings,
    missing_fields,
    recommended_action,
  }
}
