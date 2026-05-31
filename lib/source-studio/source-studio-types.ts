export type FieldType = "TEXT" | "NUMBER" | "DATE" | "TIME" | "BOOLEAN" | "RADIO" | "SELECT" | "SIGNATURE" | "NOTES";
export type BlueprintStatus = "DRAFT" | "PUBLISHED";

export interface SourceFieldBlueprint {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  instructions?: string;
  order: number;
  options?: string[]; // Used for SELECT or RADIO
  condition?: {
    dependent_field_id: string;
    operator: "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN";
    value: unknown;
  };
}

export interface SourceProcedureBlueprint {
  id: string;
  name: string;
  order: number;
}

export interface SourceFormBlueprint {
  id: string;
  study_id: string;
  name: string;
  visit_type: string;
  status: BlueprintStatus;
  version: number;
  fields: SourceFieldBlueprint[];
  procedures: SourceProcedureBlueprint[];
  updated_at: string;
}

export interface StudioState {
  forms: SourceFormBlueprint[];
  activeFormId: string | null;
  isDirty: boolean;
  isSaving: boolean;
}
