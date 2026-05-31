"use server";

import { SourceFormBlueprint } from "./source-studio-types";

// Note: For MVP, these simulate the Supabase persistence path.
// In production, these map to:
// supabase.from('source_form_blueprints').upsert(...)

export async function saveDraftBlueprint(studyId: string, form: SourceFormBlueprint): Promise<{ success: boolean; error?: string }> {
  console.log(`[Source Studio] Saving DRAFT for study ${studyId}, form ${form.id}`);
  
  // Simulated DB delay
  await new Promise(r => setTimeout(r, 600));
  
  if (form.status === "PUBLISHED") {
    return { success: false, error: "Cannot save a published blueprint as a draft." };
  }

  return { success: true };
}

export async function publishBlueprint(studyId: string, formId: string): Promise<{ success: boolean; version?: number; error?: string }> {
  console.log(`[Source Studio] PUBLISHING form ${formId} for study ${studyId}`);
  
  // Simulated DB delay
  await new Promise(r => setTimeout(r, 800));
  
  // In DB: UPDATE status = 'PUBLISHED', version = version + 1
  return { success: true, version: 2 };
}
