-- Start / Stop / Ongoing normalization for longitudinal subject records.

alter table public.subject_allergies
  add column if not exists start_date date,
  add column if not exists stop_date date,
  add column if not exists ongoing boolean not null default true,
  add column if not exists first_reaction_date date,
  add column if not exists last_reaction_date date,
  add column if not exists confirmed_allergy boolean,
  add column if not exists suspected_allergy boolean;

alter table public.subject_surgical_history
  add column if not exists ongoing boolean not null default false,
  add column if not exists complication_ongoing boolean not null default false,
  add column if not exists stop_date date,
  add column if not exists cpt_code text,
  add column if not exists surgeon_name text,
  add column if not exists facility_name text,
  add column if not exists anesthesia_type text,
  add column if not exists post_op_complications boolean,
  add column if not exists healing_status text;

alter table public.subject_progress_notes
  add column if not exists note_date date not null default current_date,
  add column if not exists note_type text,
  add column if not exists chief_complaint text,
  add column if not exists assessment text,
  add column if not exists plan text,
  add column if not exists follow_up_needed boolean not null default false,
  add column if not exists follow_up_date date,
  add column if not exists follow_up_owner text;

alter table public.subject_protocol_deviations
  add column if not exists start_date date,
  add column if not exists stop_date date,
  add column if not exists resolution_date date,
  add column if not exists ongoing boolean not null default true,
  add column if not exists deviation_type text,
  add column if not exists severity text,
  add column if not exists impact text,
  add column if not exists impact_on_subject_safety boolean,
  add column if not exists impact_on_data_integrity boolean,
  add column if not exists reported_to_sponsor boolean not null default false,
  add column if not exists reported_to_sponsor_date date,
  add column if not exists reported_to_irb boolean not null default false,
  add column if not exists reported_to_irb_date date,
  add column if not exists root_cause_category text,
  add column if not exists corrective_action text,
  add column if not exists preventive_action text,
  add column if not exists capa_due_date date,
  add column if not exists capa_completion_date date,
  add column if not exists capa_effectiveness_check_date date,
  add column if not exists notes text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid null references auth.users(id) on delete set null,
  add column if not exists closure_date date,
  add column if not exists closure_note text;

alter table public.subject_adverse_events
  add column if not exists pid_case_id text,
  add column if not exists reported_by text,
  add column if not exists report_date date,
  add column if not exists medical_confirmation text,
  add column if not exists hospitalization_required text,
  add column if not exists disability boolean,
  add column if not exists life_threatening boolean,
  add column if not exists death_related boolean,
  add column if not exists congenital_anomaly boolean,
  add column if not exists other_serious_criteria text,
  add column if not exists medication_changed text,
  add column if not exists dose_reduced boolean,
  add column if not exists drug_interrupted boolean,
  add column if not exists drug_discontinued boolean;

alter table public.subject_documents
  add column if not exists document_date date,
  add column if not exists document_version text,
  add column if not exists document_hash text,
  add column if not exists file_format text,
  add column if not exists ocr_status text,
  add column if not exists redaction_status text,
  add column if not exists retention_expiry_date date;

alter table public.subject_document_review_requests
  add column if not exists priority text not null default 'medium',
  add column if not exists escalation_date date,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists status_history jsonb not null default '[]'::jsonb,
  add column if not exists rejection_notified_to_requester boolean not null default false,
  add column if not exists rejection_notified_date date,
  add column if not exists rejection_reason text,
  add column if not exists rejected_by uuid null references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rescind_reason text,
  add column if not exists rescinded_by uuid null references auth.users(id) on delete set null,
  add column if not exists rescinded_at timestamptz;

alter table public.operational_signature_requests
  drop constraint if exists operational_signature_requests_status_check,
  add constraint operational_signature_requests_status_check check (
    status in ('pending', 'signed', 'cancelled', 'superseded', 'rejected', 'rescinded')
  );

alter table public.subject_emergency_contacts
  add column if not exists address text,
  add column if not exists primary_contact boolean not null default false,
  add column if not exists preferred_method text,
  add column if not exists availability text,
  add column if not exists language text,
  add column if not exists privacy_consent boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.subject_allergies
  drop constraint if exists subject_allergies_ongoing_stop_check,
  add constraint subject_allergies_ongoing_stop_check check (not (ongoing = true and stop_date is not null));

alter table public.subject_surgical_history
  drop constraint if exists subject_surgical_history_ongoing_stop_check,
  add constraint subject_surgical_history_ongoing_stop_check check (not (ongoing = true and stop_date is not null));

alter table public.subject_protocol_deviations
  drop constraint if exists subject_protocol_deviations_ongoing_stop_check,
  add constraint subject_protocol_deviations_ongoing_stop_check check (
    not (ongoing = true and (stop_date is not null or resolution_date is not null))
  );

alter table public.subject_adverse_events
  drop constraint if exists subject_adverse_events_ongoing_stop_check,
  add constraint subject_adverse_events_ongoing_stop_check check (not (ongoing = true and resolution_date is not null));
