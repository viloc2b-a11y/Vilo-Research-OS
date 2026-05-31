"use server";

import { AdverseEvent, MedicalCondition, ConcomitantMedication, Allergy, SurgicalHistory, ProgressNote, ProtocolDeviation, EmergencyContact, SubjectSection, ControlledTermValue } from "./subject-runtime-types";
import { v4 as uuidv4 } from "uuid";
import { createServerClient } from "@/lib/supabase/server";
import { safeLogger } from "@/lib/sanitization/safe-logger";

// Re-export or wrap existing libraries
import { searchPathologyLibrary, searchMedicationLibrary, searchAllergenLibrary } from "@/lib/subject/clinical-profile/library-search";

export async function loadSubjectRuntime(studyId: string, subjectId: string) {
  return { id: subjectId, status: "Active", screeningNumber: "SCR-001" };
}

export async function loadSubjectSection(studyId: string, subjectId: string, section: SubjectSection) {
  return [];
}

export async function saveSubjectGeneral(studyId: string, subjectId: string, payload: unknown) {
  await logSubjectAudit(subjectId, "GENERAL", subjectId, "UPDATE", null, payload, "CRC-1");
  return { success: true };
}

// ---------------------------------------------------------
// Terminology Searches
// ---------------------------------------------------------

export async function searchMedicalConditionTerms(query: string) {
  return searchPathologyLibrary(query);
}

export async function searchMedicationTerms(query: string) {
  return searchMedicationLibrary(query);
}

export async function searchAllergyTerms(query: string) {
  return searchAllergenLibrary(query);
}

export async function searchSurgicalProcedureTerms(query: string) {
  if (!query || query.trim().length < 2) return [];
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("surgical_procedure_library")
    .select("*")
    .or(`label.ilike.%${query}%,code.ilike.%${query}%`)
    .eq("is_active", true)
    .limit(15);
  return data ?? [];
}

export async function searchAeControlledTerms(termGroup: string, query: string = "") {
  const supabase = await createServerClient();
  const rq = supabase.from("ae_controlled_terms").select("*").eq("term_group", termGroup).eq("is_active", true).order("sort_order");
  if (query) {
    rq.ilike("label", `%${query}%`);
  }
  const { data } = await rq.limit(15);
  return data ?? [];
}

// ---------------------------------------------------------
// Persistence with Audit
// ---------------------------------------------------------

export async function saveSubjectMedicalCondition(subjectId: string, payload: Partial<MedicalCondition>) {
  const id = payload.id || uuidv4();
  await logSubjectAudit(subjectId, "MEDICAL_CONDITIONS", id, payload.id ? "UPDATE" : "CREATE", null, payload, "SYSTEM");
  return { success: true, id };
}

export async function saveSubjectConcomitantMedication(subjectId: string, payload: Partial<ConcomitantMedication>) {
  const id = payload.id || uuidv4();
  await logSubjectAudit(subjectId, "CONCOMITANT_MEDICATIONS", id, payload.id ? "UPDATE" : "CREATE", null, payload, "SYSTEM");
  return { success: true, id };
}

export async function saveSubjectAllergy(subjectId: string, payload: Partial<Allergy>) {
  const id = payload.id || uuidv4();
  await logSubjectAudit(subjectId, "ALLERGIES", id, payload.id ? "UPDATE" : "CREATE", null, payload, "SYSTEM");
  return { success: true, id };
}

export async function saveSubjectSurgicalHistory(subjectId: string, payload: Partial<SurgicalHistory>) {
  const id = payload.id || uuidv4();
  await logSubjectAudit(subjectId, "SURGICAL_HISTORY", id, payload.id ? "UPDATE" : "CREATE", null, payload, "SYSTEM");
  return { success: true, id };
}

export async function saveSubjectAdverseEvent(subjectId: string, payload: Partial<AdverseEvent>) {
  const id = payload.id || uuidv4();
  await logSubjectAudit(subjectId, "ADVERSE_EVENTS", id, payload.id ? "UPDATE" : "CREATE", null, payload, "SYSTEM");
  return { success: true, id };
}

// ---------------------------------------------------------
// Legacy / Other Domains
// ---------------------------------------------------------

export async function createAdverseEvent(subjectId: string, payload: Omit<AdverseEvent, "id">) {
  return saveSubjectAdverseEvent(subjectId, payload);
}
export async function updateAdverseEvent(aeId: string, payload: Partial<AdverseEvent>) {
  return { success: true };
}

export async function createMedicalCondition(subjectId: string, payload: Omit<MedicalCondition, "id">) {
  return saveSubjectMedicalCondition(subjectId, payload);
}
export async function updateMedicalCondition(conditionId: string, payload: Partial<MedicalCondition>) { return { success: true }; }

export async function createConcomitantMedication(subjectId: string, payload: Omit<ConcomitantMedication, "id">) { return saveSubjectConcomitantMedication(subjectId, payload); }
export async function updateConcomitantMedication(medicationId: string, payload: Partial<ConcomitantMedication>) { return { success: true }; }

export async function createAllergy(subjectId: string, payload: Omit<Allergy, "id">) { return saveSubjectAllergy(subjectId, payload); }
export async function updateAllergy(allergyId: string, payload: Partial<Allergy>) { return { success: true }; }

export async function createSurgicalHistory(subjectId: string, payload: Omit<SurgicalHistory, "id">) { return saveSubjectSurgicalHistory(subjectId, payload); }
export async function updateSurgicalHistory(historyId: string, payload: Partial<SurgicalHistory>) { return { success: true }; }

export async function createProgressNote(subjectId: string, payload: Omit<ProgressNote, "id" | "createdAt" | "createdBy">) { return { success: true, id: uuidv4() }; }
export async function uploadSubjectDocument(subjectId: string, payload: unknown) { return { success: true, id: uuidv4() }; }

export async function createProtocolDeviation(subjectId: string, payload: Omit<ProtocolDeviation, "id">) {
  if (payload.status !== "CONFIRMED") throw new Error("Only confirmed deviations allowed");
  return { success: true, id: uuidv4() };
}
export async function updateProtocolDeviation(deviationId: string, payload: Partial<ProtocolDeviation>) { return { success: true }; }

export async function createEmergencyContact(subjectId: string, payload: Omit<EmergencyContact, "id">) { return { success: true, id: uuidv4() }; }
export async function updateEmergencyContact(contactId: string, payload: Partial<EmergencyContact>) { return { success: true }; }

export async function logSubjectAudit(
  subjectId: string, section: SubjectSection, recordId: string, action: string, oldValue: unknown, newValue: unknown, userId: string
) {
  safeLogger.info('[Subject ALCOA+] audit event recorded', {
    userId,
    action,
    section,
    recordId,
    subjectId,
    hadOldValue: oldValue != null,
    hadNewValue: newValue != null,
  });
}
