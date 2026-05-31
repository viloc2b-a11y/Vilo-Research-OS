-- Pharmacy Dispensing Runtime v1.
-- Phase 2 builds on Pharmacy Phase 1 without changing receipt, inventory, ledger, or
-- transaction-hardening RPC foundations.

create or replace function public.pharmacy_delegated_task_labels(_action text)
returns text[]
language sql
immutable
parallel safe
as $$
  select case _action
    when 'receipt' then array['Receipt of IP', 'IP Accountability']
    when 'inventory_review' then array['Inventory Review', 'IP Accountability']
    when 'inventory_reconciliation' then array['Inventory Reconciliation', 'IP Accountability']
    when 'correction' then array['Correction of Accountability Records', 'IP Accountability']
    when 'dispense' then array['Product Dispensing']
    when 'dispensation_review' then array['Dispensation Review', 'IP Accountability Review', 'Product Dispensing Review']
    when 'return' then array['Product Return']
    when 'destruction' then array['Product Destruction']
    else array[_action]
  end;
$$;

alter table public.visit_runtime_events
  drop constraint if exists visit_runtime_events_type_check;

alter table public.visit_runtime_events
  add constraint visit_runtime_events_type_check check (
    event_type in (
      'visit_instance_created',
      'visit_started',
      'visit_completed',
      'procedure_started',
      'procedure_completed',
      'procedure_skipped',
      'field_values_saved',
      'visit_locked',
      'visit_snapshot_created',
      'visit_lock_attempt_failed',
      'ip_administration_event'
    )
  );

create table if not exists public.pharmacy_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  subject_id uuid not null references public.study_subjects(id) on delete cascade,
  randomization_id uuid null,
  assignment_required boolean not null default true,
  assignment_strategy text not null,
  assignment_timing text not null,
  randomization_dependency text not null,
  dispensing_eligibility_rules jsonb not null default '{}'::jsonb,
  assignment_source text not null default 'activated_blueprint',
  assignment_status text not null default 'eligible',
  assigned_by uuid null references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  manual_exception_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint pharmacy_subject_assignment_source_check check (
    assignment_source in ('activated_blueprint', 'manual_exception')
  ),
  constraint pharmacy_subject_assignment_status_check check (
    assignment_status in ('pending_randomization', 'eligible', 'ineligible', 'assigned', 'held')
  ),
  constraint pharmacy_subject_assignment_manual_exception_check check (
    assignment_source <> 'manual_exception'
    or (manual_exception_reason is not null and length(trim(manual_exception_reason)) > 0)
  ),
  constraint pharmacy_subject_assignment_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint pharmacy_subject_assignment_rules_object check (jsonb_typeof(dispensing_eligibility_rules) = 'object')
);

create unique index if not exists pharmacy_subject_assignments_subject_blueprint_unique
  on public.pharmacy_subject_assignments(subject_id, blueprint_id);
create index if not exists pharmacy_subject_assignments_study_idx
  on public.pharmacy_subject_assignments(study_id);
create index if not exists pharmacy_subject_assignments_status_idx
  on public.pharmacy_subject_assignments(assignment_status);

create table if not exists public.ip_dispensations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  subject_id uuid not null references public.study_subjects(id) on delete cascade,
  visit_instance_id uuid not null references public.visit_runtime_instances(id) on delete restrict,
  procedure_instance_id uuid not null references public.procedure_runtime_instances(id) on delete restrict,
  subject_assignment_id uuid null references public.pharmacy_subject_assignments(id) on delete restrict,
  kit_id uuid null references public.ip_kits(id) on delete restrict,
  lot_id uuid null references public.ip_lots(id) on delete restrict,
  dispensation_status text not null default 'dispensed',
  dispensed_at timestamptz not null default now(),
  dispensed_by uuid not null references auth.users(id) on delete restrict,
  signature_id uuid null references public.operational_signatures(id) on delete restrict,
  supporting_document_id uuid null references public.compliance_runtime_documents(id) on delete restrict,
  masked_operational_facts jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_dispensations_status_check check (
    dispensation_status in ('dispensed', 'held', 'cancelled')
  ),
  constraint ip_dispensations_masked_facts_object check (jsonb_typeof(masked_operational_facts) = 'object'),
  constraint ip_dispensations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ip_dispensations_subject_idx on public.ip_dispensations(subject_id);
create index if not exists ip_dispensations_visit_idx on public.ip_dispensations(visit_instance_id);
create index if not exists ip_dispensations_procedure_idx on public.ip_dispensations(procedure_instance_id);
create index if not exists ip_dispensations_signature_idx on public.ip_dispensations(signature_id);

create table if not exists public.ip_administration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  subject_id uuid not null references public.study_subjects(id) on delete cascade,
  visit_instance_id uuid not null references public.visit_runtime_instances(id) on delete restrict,
  procedure_instance_id uuid not null references public.procedure_runtime_instances(id) on delete restrict,
  dispensation_id uuid null references public.ip_dispensations(id) on delete restrict,
  administration_status text not null,
  administered_at timestamptz not null default now(),
  performed_by uuid not null references auth.users(id) on delete restrict,
  supporting_document_id uuid null references public.compliance_runtime_documents(id) on delete restrict,
  deviation_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_administration_status_check check (
    administration_status in (
      'dispensed',
      'administered',
      'not_administered',
      'partially_administered',
      'administration_deviation'
    )
  ),
  constraint ip_administration_deviation_reason_check check (
    administration_status <> 'administration_deviation'
    or (deviation_reason is not null and length(trim(deviation_reason)) > 0)
  ),
  constraint ip_administration_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ip_administration_events_subject_idx on public.ip_administration_events(subject_id);
create index if not exists ip_administration_events_visit_idx on public.ip_administration_events(visit_instance_id);
create index if not exists ip_administration_events_procedure_idx on public.ip_administration_events(procedure_instance_id);

create table if not exists public.ip_dispensation_review_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  subject_id uuid not null references public.study_subjects(id) on delete cascade,
  visit_instance_id uuid not null references public.visit_runtime_instances(id) on delete restrict,
  procedure_instance_id uuid not null references public.procedure_runtime_instances(id) on delete restrict,
  dispensation_id uuid not null references public.ip_dispensations(id) on delete cascade,
  execution_mode text not null,
  review_status text not null default 'pending',
  primary_crc_id uuid not null references auth.users(id) on delete restrict,
  secondary_crc_id uuid null references auth.users(id) on delete restrict,
  due_at timestamptz null,
  reviewed_at timestamptz null,
  attestation_text text null,
  visibility_scope text not null default 'masked',
  review_mode text not null default 'blinded',
  signature_request_id uuid null references public.operational_signature_requests(id) on delete restrict,
  signature_id uuid null references public.operational_signatures(id) on delete restrict,
  waiver_reason text null,
  waiver_authorized_by uuid null references auth.users(id) on delete set null,
  protocol_basis text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_disp_review_execution_mode_check check (
    execution_mode in ('real_time_required', 'asynchronous_required', 'optional', 'not_required')
  ),
  constraint ip_disp_review_status_check check (
    review_status in ('pending', 'reviewed', 'overdue', 'waived', 'not_required')
  ),
  constraint ip_disp_review_separation_check check (
    secondary_crc_id is null or secondary_crc_id <> primary_crc_id
  ),
  constraint ip_disp_review_signature_required_check check (
    review_status <> 'reviewed'
    or (secondary_crc_id is not null and reviewed_at is not null and signature_id is not null)
  ),
  constraint ip_disp_review_waiver_reason_check check (
    review_status <> 'waived'
    or (waiver_reason is not null and length(trim(waiver_reason)) > 0)
  ),
  constraint ip_disp_review_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ip_disp_review_subject_idx
  on public.ip_dispensation_review_confirmations(subject_id);
create index if not exists ip_disp_review_status_idx
  on public.ip_dispensation_review_confirmations(study_id, review_status, due_at);
create index if not exists ip_disp_review_dispensation_idx
  on public.ip_dispensation_review_confirmations(dispensation_id);

create table if not exists public.pharmacy_dispensing_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  subject_id uuid null references public.study_subjects(id) on delete set null,
  visit_instance_id uuid null references public.visit_runtime_instances(id) on delete set null,
  procedure_instance_id uuid null references public.procedure_runtime_instances(id) on delete set null,
  dispensation_id uuid null references public.ip_dispensations(id) on delete set null,
  administration_event_id uuid null references public.ip_administration_events(id) on delete set null,
  review_confirmation_id uuid null references public.ip_dispensation_review_confirmations(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint pharmacy_dispensing_audit_type_required check (length(trim(event_type)) > 0),
  constraint pharmacy_dispensing_audit_payload_object check (jsonb_typeof(event_payload) = 'object')
);

create index if not exists pharmacy_dispensing_audit_study_idx
  on public.pharmacy_dispensing_audit_events(study_id, occurred_at desc);
create index if not exists pharmacy_dispensing_audit_subject_idx
  on public.pharmacy_dispensing_audit_events(subject_id, occurred_at desc);

create or replace function public.pharmacy_dispensing_active_blueprint_gate()
returns trigger
language plpgsql
as $$
begin
  if not public.pharmacy_blueprint_is_active(new.blueprint_id) then
    raise exception 'Cannot write Pharmacy Dispensing Runtime record without active Pharmacy Runtime Blueprint';
  end if;
  return new;
end;
$$;

drop trigger if exists pharmacy_subject_assignments_active_blueprint_gate
  on public.pharmacy_subject_assignments;
create trigger pharmacy_subject_assignments_active_blueprint_gate
before insert or update on public.pharmacy_subject_assignments
for each row execute function public.pharmacy_dispensing_active_blueprint_gate();

drop trigger if exists ip_dispensations_active_blueprint_gate
  on public.ip_dispensations;
create trigger ip_dispensations_active_blueprint_gate
before insert or update on public.ip_dispensations
for each row execute function public.pharmacy_dispensing_active_blueprint_gate();

drop trigger if exists ip_administration_events_active_blueprint_gate
  on public.ip_administration_events;
create trigger ip_administration_events_active_blueprint_gate
before insert or update on public.ip_administration_events
for each row execute function public.pharmacy_dispensing_active_blueprint_gate();

drop trigger if exists ip_disp_review_active_blueprint_gate
  on public.ip_dispensation_review_confirmations;
create trigger ip_disp_review_active_blueprint_gate
before insert or update on public.ip_dispensation_review_confirmations
for each row execute function public.pharmacy_dispensing_active_blueprint_gate();

create or replace view public.ip_dispensation_command_center_actions as
select
  r.organization_id,
  r.study_id,
  r.site_id,
  r.subject_id,
  r.visit_instance_id,
  r.procedure_instance_id,
  r.dispensation_id,
  r.id as review_confirmation_id,
  case
    when r.review_status = 'waived' and coalesce((r.metadata ->> 'waiver_requires_approval')::boolean, false)
      then 'Waiver Requires Approval'
    when r.review_status = 'overdue'
      or (r.review_status = 'pending' and r.due_at is not null and r.due_at < now())
      then 'Review Overdue'
    when r.review_status = 'pending' and r.due_at is not null and r.due_at::date <= current_date
      then 'Review Due Today'
    when r.review_status = 'pending'
      then 'Review Dispensation'
    else null
  end as action_required,
  r.execution_mode,
  r.review_status,
  r.due_at
from public.ip_dispensation_review_confirmations r
where r.review_status in ('pending', 'overdue', 'waived')
  and r.execution_mode <> 'not_required'
  and public.pharmacy_user_can_access_action(r.study_id, r.site_id, 'dispensation_review');

alter table public.pharmacy_subject_assignments enable row level security;
alter table public.ip_dispensations enable row level security;
alter table public.ip_administration_events enable row level security;
alter table public.ip_dispensation_review_confirmations enable row level security;
alter table public.pharmacy_dispensing_audit_events enable row level security;

create policy pharmacy_subject_assignments_select
  on public.pharmacy_subject_assignments
  for select using (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'));
create policy pharmacy_subject_assignments_insert
  on public.pharmacy_subject_assignments
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'));
create policy pharmacy_subject_assignments_update
  on public.pharmacy_subject_assignments
  for update using (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'))
  with check (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'));

create policy ip_dispensations_select_unblinded
  on public.ip_dispensations
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
create policy ip_dispensations_insert
  on public.ip_dispensations
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'));

create policy ip_administration_events_select_unblinded
  on public.ip_administration_events
  for select using (public.pharmacy_user_can_view_unblinded_ip(study_id, site_id));
create policy ip_administration_events_insert
  on public.ip_administration_events
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'));

create policy ip_disp_review_select
  on public.ip_dispensation_review_confirmations
  for select using (public.pharmacy_user_can_access_action(study_id, site_id, 'dispensation_review'));
create policy ip_disp_review_insert
  on public.ip_dispensation_review_confirmations
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'dispense'));
create policy ip_disp_review_update
  on public.ip_dispensation_review_confirmations
  for update using (public.pharmacy_user_can_access_action(study_id, site_id, 'dispensation_review'))
  with check (public.pharmacy_user_can_access_action(study_id, site_id, 'dispensation_review'));

create policy pharmacy_dispensing_audit_select
  on public.pharmacy_dispensing_audit_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );
create policy pharmacy_dispensing_audit_insert
  on public.pharmacy_dispensing_audit_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

grant select on public.ip_dispensation_command_center_actions to authenticated;
grant execute on function public.pharmacy_delegated_task_labels(text) to authenticated, anon;
