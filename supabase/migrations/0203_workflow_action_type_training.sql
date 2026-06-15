-- Extends subject_workflow_actions.action_type to support amendment training review tasks.
-- amendment_training_review: study-level coordinator task queued on amendment activation
-- when the amendment requires staff retraining before enrollment continues.

ALTER TABLE public.subject_workflow_actions
  DROP CONSTRAINT IF EXISTS subject_workflow_actions_action_type_check;

ALTER TABLE public.subject_workflow_actions
  ADD CONSTRAINT subject_workflow_actions_action_type_check
  CHECK (action_type IN (
    'action',
    'query',
    'signature_request',
    'follow_up',
    'correction',
    'capa_item',
    'amendment_reconsent',
    'amendment_training_review',
    'deviation_followup',
    'safety_followup'
  ));
