-- Sprint I2: Vitalis → Subject Runtime handoff
-- Adds patient_lead_id to study_subjects to create a bidirectional attribution link
-- between the patient CRM (Vitalis) and the subject runtime.
-- patient_leads.linked_subject_id already tracks the forward link (lead → subject).
-- This column adds the reverse (subject → originating lead) for enrollment attribution.

ALTER TABLE public.study_subjects
  ADD COLUMN IF NOT EXISTS patient_lead_id uuid
    REFERENCES public.patient_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS study_subjects_patient_lead_idx
  ON public.study_subjects(patient_lead_id)
  WHERE patient_lead_id IS NOT NULL;
