/**
 * Staging pilot defaults (phase2-validation-study / PHASE9A-PILOT-001).
 * Override via PHASE11_* env in CI or .env.local.
 */
export const PILOT_FIXTURE_DEFAULTS = {
  studyId: '6bae715a-8536-4000-8d24-22b6a3dbb8c9',
  organizationId: 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e',
  studySubjectId: '4384b789-4e16-4512-b3f3-50642b3b9735',
  visitId: '6690da63-4bf1-4681-815a-3e39b7b014bc',
  coordinatorActorUserId: 'd7e43ee5-5c08-489b-b293-8ef288e7fdb7',
  studySlug: 'phase2-validation-study',
  subjectIdentifier: 'PHASE9A-PILOT-001',
  canonicalSourceDefinitionVersionId: '2ee5a544-fba6-4edb-a5c1-61ba5e2eee00',
  screeningProcedureDefinitionId: '17059af6-37fa-48a5-9bef-e82b7e2606b1',
  /** Materialized Screening CBC procedure execution (when present on fixture visit) */
  screeningProcedureExecutionId: 'c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc',
} as const

export const PHASE11_ENV_KEYS = [
  'PHASE11_STUDY_ID',
  'PHASE11_ORG_ID',
  'PHASE11_SUBJECT_ID',
  'PHASE11_VISIT_ID',
  'PHASE11_COORDINATOR_ACTOR_ID',
] as const
