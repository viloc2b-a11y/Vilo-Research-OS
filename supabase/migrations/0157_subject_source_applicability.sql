-- Phase X: Subject Source Applicability Engine

ALTER TABLE public.procedure_executions 
  ADD COLUMN IF NOT EXISTS applicability_status text NOT NULL DEFAULT 'applicable' CHECK (applicability_status IN ('applicable', 'not_applicable', 'skipped', 'missed', 'contraindicated', 'protocol_exception', 'medical_exception')),
  ADD COLUMN IF NOT EXISTS applicability_reason text,
  ADD COLUMN IF NOT EXISTS applicability_set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicability_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_applicability_status text;

-- If section was disabled, backfill to 'skipped' for now as a baseline
UPDATE public.procedure_executions
SET 
  applicability_status = 'skipped',
  applicability_reason = COALESCE(section_disabled_reason, 'Migrated from legacy section_disabled'),
  applicability_set_by = section_disabled_by,
  applicability_set_at = section_disabled_at
WHERE section_disabled_at IS NOT NULL AND applicability_status = 'applicable';
