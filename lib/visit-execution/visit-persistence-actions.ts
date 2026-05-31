"use server";

import { VisitState } from "./visit-execution-types";
import { logALCOAEvent } from "./alcoa-audit-logger";

type VisitFieldValue = string | number | boolean | null;
type VisitFieldRecord = {
  value: VisitFieldValue
  last_updated_by: string
  last_updated_at: string
}

const visitStates = new Map<string, VisitState>()
const visitValues = new Map<string, Record<string, VisitFieldRecord>>()

export async function loadStudySubjects(studyId: string) {
  return [{ id: "SUBJ-001", status: "Active" }, { id: "SUBJ-002", status: "Screening" }];
}

export async function loadSubjectTimeline(studyId: string, subjectId: string) {
  return [
    { id: "V-1", name: "Screening", state: "FINALIZED" },
    { id: "V-2", name: "Baseline", state: "IN_PROGRESS" }
  ];
}

export async function loadVisitRuntime(studyId: string, subjectId: string, visitId: string) {
  return {
    visit: { id: visitId, state: visitStates.get(visitId) ?? ("IN_PROGRESS" as VisitState) },
    formValues: visitValues.get(visitId) ?? {}
  };
}

export async function saveFieldValue(visitId: string, formId: string, fieldId: string, value: VisitFieldValue, oldValue: VisitFieldValue = null, actorId: string = "CRC-1") {
  await logALCOAEvent(visitId, fieldId, oldValue, value, actorId);
  const current = visitValues.get(visitId) ?? {}
  current[fieldId] = {
    value,
    last_updated_by: actorId,
    last_updated_at: new Date().toISOString(),
  }
  visitValues.set(visitId, current)
  return { success: true };
}

export async function saveFormDraft(visitId: string, formId: string, values: Record<string, VisitFieldValue>) {
  return { success: true };
}

export async function markFormComplete(visitId: string, formId: string) {
  return { success: true };
}

export async function updateVisitRuntimeState(visitId: string, state: VisitState) {
  visitStates.set(visitId, state)
  return { success: true };
}

export const saveFieldData = saveFieldValue
export const updateVisitState = updateVisitRuntimeState

export async function loadVisitSession(visitId: string) {
  return loadVisitRuntime("ST-1", "SUBJ-1", visitId)
}
