-- Subject Source Template completion.
-- Extends the canonical subject chart with coordinator-owned longitudinal
-- sections. Reuses existing terminology libraries and audit ledger.

alter table public.subject_clinical_profile_events
  drop constraint if exists subject_clinical_profile_events_section_check;

alter table public.subject_clinical_profile_events
  add constraint subject_clinical_profile_events_section_check check (
    section in (
      'medical_history',
      'conmeds',
      'allergies',
      'surgical_history',
      'lifestyle',
      'adverse_events',
      'progress_notes',
      'subject_documents',
      'document_reviews',
      'subject_status',
      'subject_signatures',
      'protocol_deviations',
      'emergency_contacts'
    )
  );

alter table public.subject_surgical_history
  add column if not exists surgical_procedure_library_id uuid null references public.surgical_procedure_library(id) on delete set null,
  add column if not exists procedure_code text,
  add column if not exists procedure_source_library text,
  add column if not exists free_text_override boolean not null default false,
  add column if not exists complications text;

alter table public.subject_adverse_events
  add column if not exists ae_type text,
  add column if not exists expectedness text,
  add column if not exists action_taken text,
  add column if not exists outcome text,
  add column if not exists ongoing boolean not null default true,
  add column if not exists requires_pi_si_review boolean not null default false,
  add column if not exists ae_type_term jsonb not null default '{"sourceLibrary":"ae_controlled_terms","freeTextOverride":false}'::jsonb,
  add column if not exists severity_term jsonb null,
  add column if not exists relatedness_term jsonb null,
  add column if not exists expectedness_term jsonb null,
  add column if not exists action_taken_term jsonb null,
  add column if not exists outcome_term jsonb null;

create table if not exists public.subject_progress_notes (
  note_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects(id) on delete cascade,
  category text not null default 'General operational note',
  note text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subject_documents (
  document_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects(id) on delete cascade,
  visit_id uuid null references public.visits(id) on delete set null,
  compliance_document_id uuid null references public.compliance_runtime_documents(id) on delete set null,
  document_category text not null,
  file_name text not null,
  file_path text,
  mime_type text,
  file_size bigint,
  status text not null default 'Available',
  notes text,
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_documents_status_check check (
    status in ('Not Requested', 'Available', 'Requested', 'Viewed', 'Review Requested', 'Review Completed', 'Reviewed', 'Signature Requested', 'Signed', 'Rejected', 'Rescinded')
  )
);

create table if not exists public.subject_document_review_requests (
  request_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects(id) on delete cascade,
  document_id uuid not null references public.subject_documents(document_id) on delete cascade,
  request_type text not null,
  requested_by uuid null references auth.users(id) on delete set null,
  requested_to uuid null references auth.users(id) on delete set null,
  message text,
  due_date date,
  status text not null default 'Not Requested',
  completed_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_document_review_type_check check (request_type in ('Review', 'Signature')),
  constraint subject_document_review_status_check check (
    status in ('Not Requested', 'Requested', 'Viewed', 'Review Requested', 'Review Completed', 'Reviewed', 'Signature Requested', 'Signed', 'Rejected', 'Rescinded')
  )
);

create table if not exists public.subject_status_history (
  status_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects(id) on delete cascade,
  status text not null,
  start_date date not null,
  stop_date date,
  ongoing boolean not null default true,
  reason text,
  notes text,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_status_history_status_check check (
    status in (
      'Screening',
      'Screen Failure',
      'Enrolled',
      'Randomized',
      'Active Treatment',
      'Follow-Up',
      'Withdrawn',
      'Lost To Follow-Up',
      'Early Termination',
      'Completed'
    )
  ),
  constraint subject_status_history_ongoing_stop_check check (
    not (ongoing = true and stop_date is not null)
  )
);

create table if not exists public.subject_protocol_deviations (
  deviation_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects(id) on delete cascade,
  description text not null,
  deviation_date date not null,
  category text,
  root_cause text,
  capa text,
  status text not null default 'Open',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subject_emergency_contacts (
  contact_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  notes text,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subject_progress_notes_subject_idx on public.subject_progress_notes(study_subject_id, created_at desc);
create index if not exists subject_documents_subject_idx on public.subject_documents(study_subject_id, created_at desc);
create index if not exists subject_document_reviews_subject_idx on public.subject_document_review_requests(study_subject_id, created_at desc);
create index if not exists subject_status_history_subject_idx on public.subject_status_history(study_subject_id, start_date desc);
create index if not exists subject_protocol_deviations_subject_idx on public.subject_protocol_deviations(study_subject_id, deviation_date desc);
create index if not exists subject_emergency_contacts_subject_idx on public.subject_emergency_contacts(study_subject_id, created_at desc);

create or replace function public.subject_source_template_enforce_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  select organization_id, study_id into s
  from public.study_subjects
  where id = new.study_subject_id;

  if s is null then
    raise exception 'study_subject_id % not found', new.study_subject_id;
  end if;

  new.organization_id := s.organization_id;
  new.study_id := s.study_id;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'subject_progress_notes',
    'subject_documents',
    'subject_document_review_requests',
    'subject_status_history',
    'subject_protocol_deviations',
    'subject_emergency_contacts'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I on public.%I', t || '_enforce_subject', t);
    execute format(
      'create trigger %I before insert or update of organization_id, study_id, study_subject_id on public.%I for each row execute function public.subject_source_template_enforce_row()',
      t || '_enforce_subject',
      t
    );
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.generic_set_updated_at()',
      t || '_set_updated_at',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (organization_id in (select public.user_organization_ids()) or public.user_has_study_access(study_id))',
      t || '_select',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (organization_id in (select public.user_organization_ids()) or public.user_has_study_access(study_id))',
      t || '_insert',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update using (organization_id in (select public.user_organization_ids()) or public.user_has_study_access(study_id)) with check (organization_id in (select public.user_organization_ids()) or public.user_has_study_access(study_id))',
      t || '_update',
      t
    );
  end loop;
end $$;
