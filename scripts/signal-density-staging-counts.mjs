/**
 * Staging signal density counts for SUBJ-P2VAL-001 (or first study subject).
 * Run: node scripts/signal-density-staging-counts.mjs
 */
import { loadEnvFiles } from './lib/env.mjs'
import postgres from 'postgres'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!url) {
  console.error('no DATABASE_URL')
  process.exit(1)
}

const STUDY_ID = process.argv[2] ?? '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const SUBJECT_ID = process.argv[3] ?? '3bae1645-b94b-441c-b081-916a03896b0e'

const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const orgRow = await sql`
  select organization_id from studies where id = ${STUDY_ID} limit 1
`
const orgId = orgRow[0]?.organization_id
if (!orgId) {
  console.error('study not found')
  process.exit(1)
}

const visits = await sql`
  select v.id, vd.label, v.visit_status, v.visit_review_status
  from visits v
  left join visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_subject_id = ${SUBJECT_ID}
    and v.organization_id = ${orgId}
`

const visitIds = visits.map((v) => v.id)

const procedures =
  visitIds.length === 0
    ? []
    : await sql`
        select pe.id, pe.visit_id, pe.validation_status, pd.label as proc_label
        from procedure_executions pe
        left join procedure_definitions pd on pd.id = pe.procedure_definition_id
        where pe.organization_id = ${orgId}
          and pe.visit_id = any(${visitIds})
      `

const incompleteProcs = procedures.filter((p) => p.validation_status === 'incomplete')
const blockedProcs = procedures.filter((p) => p.validation_status === 'blocked')

const IN_FLIGHT = new Set([
  'in_progress',
  'completed',
  'checked_in',
  'out_of_window',
  'scheduled',
])

const coordSigs = visits.filter(
  (v) =>
    IN_FLIGHT.has(v.visit_status) &&
    (v.visit_review_status === 'draft' || v.visit_review_status === 'reopened'),
)
const invSigs = visits.filter(
  (v) => IN_FLIGHT.has(v.visit_status) && v.visit_review_status === 'coordinator_signed',
)

const uniqueIncompleteLabels = new Set(
  incompleteProcs.map((p) => `${p.proc_label ?? 'Procedure'} — incomplete`),
)
const uniqueBlockedLabels = new Set(
  blockedProcs.map((p) => `${p.proc_label ?? 'Procedure'} — blocking validation`),
)

const before = {
  incompleteProcedureRows: incompleteProcs.length,
  blockedProcedureRows: blockedProcs.length,
  coordinatorSignatureRows: coordSigs.length,
  investigatorSignatureRows: invSigs.length,
  validationIssueRows: incompleteProcs.length + blockedProcs.length,
  aeProcedureValidationEstimate: incompleteProcs.length + blockedProcs.length,
  regulatorySignatureRows: coordSigs.length + invSigs.length,
}

const after = {
  incompleteProcedureGroups: uniqueIncompleteLabels.size,
  blockedProcedureGroups: uniqueBlockedLabels.size,
  coordinatorSignatureGroups: coordSigs.length > 0 ? 1 : 0,
  investigatorSignatureGroups: invSigs.length > 0 ? 1 : 0,
  validationIssueGroups:
    uniqueIncompleteLabels.size + uniqueBlockedLabels.size,
  aeProcedureValidationEstimate:
    uniqueIncompleteLabels.size + uniqueBlockedLabels.size,
  regulatorySignatureGroups:
    (coordSigs.length > 0 ? 1 : 0) + (invSigs.length > 0 ? 1 : 0),
}

const caps = {
  commandCenterValidationVisible: 8,
  commandCenterSignaturesVisible: 5,
  overlayListVisible: 12,
  workflowGroupVisible: 10,
}

console.log(
  JSON.stringify(
    {
      studyId: STUDY_ID,
      subjectId: SUBJECT_ID,
      organizationId: orgId,
      visitCount: visits.length,
      before,
      after,
      cappedDisplay: {
        generalValidationShown: Math.min(after.validationIssueGroups, caps.commandCenterValidationVisible),
        generalValidationHidden: Math.max(0, after.validationIssueGroups - caps.commandCenterValidationVisible),
        generalSignaturesShown: Math.min(
          after.coordinatorSignatureGroups + after.investigatorSignatureGroups,
          caps.commandCenterSignaturesVisible,
        ),
        overlayListShown: Math.min(after.aeProcedureValidationEstimate, caps.overlayListVisible),
        overlayListHidden: Math.max(0, after.aeProcedureValidationEstimate - caps.overlayListVisible),
      },
    },
    null,
    2,
  ),
)

await sql.end()
