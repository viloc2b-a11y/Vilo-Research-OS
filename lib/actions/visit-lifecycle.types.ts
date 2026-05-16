export type VisitLifecycleResult =
  | { ok: true; idempotent?: boolean }
  | { ok: false; message: string }

export type VisitLifecycleRpcPayload = {
  ok: boolean
  error?: string | null
  visit_id?: string | null
  organization_id?: string | null
  study_id?: string | null
  visit_status?: string | null
  operational_event_id?: string | null
  idempotent?: boolean | null
}
