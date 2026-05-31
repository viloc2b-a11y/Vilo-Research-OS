export type VisitState = 
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "READY_FOR_REVIEW"
  | "READY_FOR_FINALIZATION"
  | "FINALIZED";

export interface VisitInstance {
  id: string;
  study_id: string;
  subject_id: string;
  source_blueprint_id: string;
  state: VisitState;
  created_at: string;
  updated_at: string;
}

export interface FieldValue {
  field_id: string;
  value: string | number | boolean | null;
  last_updated_by: string;
  last_updated_at: string;
}

export interface FormInstance {
  id: string;
  visit_instance_id: string;
  form_blueprint_id: string;
  values: Record<string, FieldValue>;
}

export interface ALCOAAuditEvent {
  id: string;
  visit_instance_id: string;
  field_id: string;
  old_value: unknown;
  new_value: unknown;
  actor_id: string;
  timestamp: string;
  reason?: string;
}
