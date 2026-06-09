import assert from 'node:assert/strict'
import { canExecuteVisit } from '../lib/subject/consent/guards'
import { validateConsentRecord } from '../lib/subject/consent/validate-consent-record'

type MockRow = Record<string, unknown>

function makeQuery(rows: MockRow[]) {
  const filters: Array<{ kind: 'eq' | 'in'; column: string; value: unknown }> = []
  let limitCount: number | null = null

  const api: any = {
    select() {
      return api
    },
    eq(column: string, value: unknown) {
      filters.push({ kind: 'eq', column, value })
      return api
    },
    in(column: string, value: unknown) {
      filters.push({ kind: 'in', column, value })
      return api
    },
    limit(count: number) {
      limitCount = count
      return api
    },
    order() {
      return api
    },
    is(column: string, value: unknown) {
      filters.push({ kind: 'eq', column, value })
      return api
    },
    maybeSingle() {
      const data = applyFilters(rows, filters, limitCount)[0] ?? null
      return Promise.resolve({ data, error: null })
    },
    single() {
      const data = applyFilters(rows, filters, limitCount)[0] ?? null
      if (!data) return Promise.resolve({ data: null, error: new Error('No rows found') })
      return Promise.resolve({ data, error: null })
    },
    then(resolve: (value: { data: MockRow[]; error: null }) => unknown) {
      return Promise.resolve({ data: applyFilters(rows, filters, limitCount), error: null }).then(resolve)
    },
  }

  return api
}

function applyFilters(
  rows: MockRow[],
  filters: Array<{ kind: 'eq' | 'in'; column: string; value: unknown }>,
  limitCount: number | null,
) {
  const filtered = rows.filter((row) =>
    filters.every((filter) => {
      const value = row[filter.column]
      if (filter.kind === 'eq') return value === filter.value
      return Array.isArray(filter.value) ? filter.value.includes(value) : false
    }),
  )
  return limitCount ? filtered.slice(0, limitCount) : filtered
}

function makeMockSupabase(tables: Record<string, MockRow[]>) {
  return {
    from(table: string) {
      return makeQuery(tables[table] ?? [])
    },
  } as any
}

function assertComplete(label: string, input: Parameters<typeof validateConsentRecord>[0]) {
  const result = validateConsentRecord(input)
  assert.equal(result.is_complete, true, `${label} should be complete`)
  assert.equal(result.blocking_issues.length, 0, `${label} should have no blocking issues`)
  return result
}

async function main() {
  const electronic = assertComplete('electronic consent', {
    libraryStatus: 'active',
    completionMethod: 'electronic_patient_signature',
    consentStatus: 'consented',
    consentDateTime: '2026-06-03T09:00:00.000Z',
    subjectSignedAt: '2026-06-03T09:00:00.000Z',
    coordinatorSignedAt: '2026-06-03T09:05:00.000Z',
    participantCopyProvided: true,
    evidenceCount: 1,
    activeVersionUsed: true,
    trainingValid: true,
    delegationValid: true,
  })

  const paper = assertComplete('paper consent', {
    libraryStatus: 'active',
    completionMethod: 'paper_signed_attested',
    consentStatus: 'consented',
    consentDateTime: '2026-06-03T10:00:00.000Z',
    subjectSignedAt: '2026-06-03T09:59:00.000Z',
    coordinatorSignedAt: '2026-06-03T10:01:00.000Z',
    participantCopyProvided: true,
    evidenceCount: 1,
    consentDocumentUploadPending: true,
    activeVersionUsed: true,
    trainingValid: true,
    delegationValid: true,
  })

  const missingSignature = validateConsentRecord({
    libraryStatus: 'active',
    completionMethod: 'electronic_patient_signature',
    consentStatus: 'pending_signature',
    consentDateTime: '2026-06-03T11:00:00.000Z',
    coordinatorSignedAt: '2026-06-03T11:01:00.000Z',
    participantCopyProvided: false,
    evidenceCount: 0,
    activeVersionUsed: true,
    trainingValid: true,
    delegationValid: true,
  })
  assert.equal(missingSignature.is_complete, false, 'missing signature consent should be incomplete')
  assert.ok(
    missingSignature.blocking_issues.some((issue) => issue.includes('Subject signature is missing')),
    'missing signature should be a blocking issue',
  )

  const inactiveVersion = validateConsentRecord({
    libraryStatus: 'retired',
    completionMethod: 'paper_signed_attested',
    consentStatus: 'consented',
    consentDateTime: '2026-06-03T11:30:00.000Z',
    subjectSignedAt: '2026-06-03T11:29:00.000Z',
    coordinatorSignedAt: '2026-06-03T11:31:00.000Z',
    participantCopyProvided: true,
    evidenceCount: 1,
    activeVersionUsed: false,
    trainingValid: true,
    delegationValid: true,
  })
  assert.equal(inactiveVersion.is_complete, false, 'inactive version should block')
  assert.ok(
    inactiveVersion.blocking_issues.some((issue) => issue.includes('inactive or unapproved')),
    'inactive version must block consent',
  )

  const piOptional = validateConsentRecord({
    libraryStatus: 'active',
    completionMethod: 'paper_signed_attested',
    consentStatus: 'consented',
    consentDateTime: '2026-06-03T11:45:00.000Z',
    subjectSignedAt: '2026-06-03T11:44:00.000Z',
    coordinatorSignedAt: '2026-06-03T11:46:00.000Z',
    participantCopyProvided: true,
    evidenceCount: 1,
    activeVersionUsed: true,
    trainingValid: true,
    delegationValid: true,
    piSignatureRequired: false,
  })
  assert.ok(
    piOptional.warnings.some((warning) => warning.includes('PI/Sub-I signature not present')),
    'optional PI signature should generate a warning only',
  )
  assert.equal(piOptional.is_complete, true, 'optional PI signature should not block completion')

  const reconsentNeeded = validateConsentRecord({
    libraryStatus: 'active',
    completionMethod: 'paper_signed_attested',
    consentStatus: 'consented',
    consentDateTime: '2026-06-03T12:00:00.000Z',
    subjectSignedAt: '2026-06-03T11:59:00.000Z',
    coordinatorSignedAt: '2026-06-03T12:01:00.000Z',
    participantCopyProvided: true,
    evidenceCount: 1,
    activeVersionUsed: true,
    trainingValid: true,
    delegationValid: true,
    reconsentActionRequired: true,
    reconsentStatus: 'overdue',
  })
  assert.ok(
    reconsentNeeded.warnings.some((warning) => warning.toLowerCase().includes('reconsent is overdue')),
    'overdue reconsent should warn',
  )

  const activeVisitSupabase = makeMockSupabase({
    subject_consent_versions: [
      {
        id: 'consent-active-1',
        active_at: '2026-06-03T08:00:00.000Z',
        completed_at: '2026-06-03T08:00:00.000Z',
        study_subject_id: 'subject-1',
        consent_type: 'initial_consent',
        status: 'active',
      },
    ],
    subject_consent_withdrawals: [],
    subject_consent_reconsent_requirements: [],
  })

  const activeVisit = await canExecuteVisit(activeVisitSupabase, { subjectId: 'subject-1' })
  assert.equal(activeVisit.ok, true, 'visit gate should allow active consent')

  const blockedVisitSupabase = makeMockSupabase({
    subject_consent_versions: [],
    subject_consent_withdrawals: [],
    subject_consent_reconsent_requirements: [],
  })
  const blockedVisit = await canExecuteVisit(blockedVisitSupabase, { subjectId: 'subject-2' })
  assert.equal(blockedVisit.ok, false, 'visit gate should block without active consent')

  console.log(
    JSON.stringify(
      {
        ok: true,
        electronicStatus: electronic.recommended_action,
        paperStatus: paper.recommended_action,
        missingSignatureIssues: missingSignature.blocking_issues,
        inactiveVersionIssues: inactiveVersion.blocking_issues,
        visitGateActive: activeVisit.ok,
        visitGateBlocked: blockedVisit.ok,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
