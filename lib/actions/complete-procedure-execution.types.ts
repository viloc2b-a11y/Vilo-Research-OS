/** Aligns with docs/PHASE2-CLINICAL-DOMAIN-SCHEMA.md section 7.4 (`PROCEDURE_COMPLETED`). */
export const OPERATIONAL_EVENT_PROCEDURE_COMPLETED = 'PROCEDURE_COMPLETED'

export type CompleteProcedureResult =
  | { ok: true; idempotent?: boolean }
  | { ok: false; message: string }

/** Returned by Postgres `complete_procedure_execution` RPC (typed loosely for JSON coercion). */
export type CompleteProcedureRpcPayload = {
  ok: boolean
  error?: string | null
  procedure_execution_id?: string | null
  organization_id?: string | null
  study_id?: string | null
  visit_id?: string | null
  execution_status?: string | null
  /** Present when mutations are refused due to terminal visit lifecycle. */
  visit_status?: string | null
  operational_event_id?: string | null
  idempotent?: boolean | null
}
