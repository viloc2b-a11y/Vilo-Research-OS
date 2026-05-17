-- Phase 4C.9: published rules, workflow, signature, external, runtime expectation snapshots.
-- Dependencies: 0026 source_publish_packages, 0027 published_source_definitions.

-- ---------------------------------------------------------------------------
-- published_source_validation_rules
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_validation_rules (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  validation_rule_id text not null,
  scope text,
  scope_id text,
  rule_type text,
  rule_payload_json jsonb not null default '{}'::jsonb,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_validation_rules_payload_object check (
    jsonb_typeof (rule_payload_json) = 'object'
    and jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_validation_rules_unique_per_package unique (
    organization_id,
    package_id,
    validation_rule_id
  ),
  constraint published_validation_rules_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_validation_rules_org_package_idx on public.published_source_validation_rules (organization_id, package_id);

-- ---------------------------------------------------------------------------
-- published_source_conditional_rules
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_conditional_rules (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  conditional_rule_id text not null,
  rule_id text,
  trigger_type text,
  trigger_field text,
  operator text,
  trigger_value text,
  then_action text,
  applies_to text,
  applies_to_id text,
  hard_stop boolean not null default false,
  requires_review boolean not null default false,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_conditional_rules_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_conditional_rules_unique_per_package unique (
    organization_id,
    package_id,
    conditional_rule_id
  ),
  constraint published_conditional_rules_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_conditional_rules_org_package_idx on public.published_source_conditional_rules (organization_id, package_id);

-- ---------------------------------------------------------------------------
-- published_source_workflow_requirements
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_workflow_requirements (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  workflow_requirement_id text not null,
  workflow_type text not null,
  trigger_expression text,
  action text,
  required_role text,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_workflow_requirements_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_workflow_requirements_unique_per_package unique (
    organization_id,
    package_id,
    workflow_requirement_id
  ),
  constraint published_workflow_requirements_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_workflow_requirements_org_package_idx on public.published_source_workflow_requirements (organization_id, package_id);

-- ---------------------------------------------------------------------------
-- published_source_signature_requirements
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_signature_requirements (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  signature_requirement_id text not null,
  source_definition_version_id text,
  source_section_id text,
  required_role text not null,
  signature_order integer not null default 1,
  signature_meaning_code text,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_signature_requirements_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_signature_requirements_unique_per_package unique (
    organization_id,
    package_id,
    signature_requirement_id
  ),
  constraint published_signature_requirements_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_signature_requirements_org_package_idx on public.published_source_signature_requirements (organization_id, package_id);

create index if not exists published_signature_requirements_sdv_idx on public.published_source_signature_requirements (
  organization_id,
  package_id,
  source_definition_version_id
);

create index if not exists published_signature_requirements_section_idx on public.published_source_signature_requirements (
  organization_id,
  package_id,
  source_section_id
);

-- ---------------------------------------------------------------------------
-- published_source_external_requirements
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_external_requirements (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  external_source_requirement_id text not null,
  source_definition_version_id text,
  source_section_id text,
  external_source_name text not null,
  external_system_type text,
  ref_id_field text,
  status_field text,
  attachment_allowed boolean not null default false,
  audit_requirement boolean not null default true,
  capture_strategy text not null default 'metadata_reference_only',
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_external_requirements_provenance_object check (
    jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_external_requirements_unique_per_package unique (
    organization_id,
    package_id,
    external_source_requirement_id
  ),
  constraint published_external_requirements_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_external_requirements_org_package_idx on public.published_source_external_requirements (organization_id, package_id);

create index if not exists published_external_requirements_sdv_idx on public.published_source_external_requirements (
  organization_id,
  package_id,
  source_definition_version_id
);

create index if not exists published_external_requirements_section_idx on public.published_source_external_requirements (
  organization_id,
  package_id,
  source_section_id
);

-- ---------------------------------------------------------------------------
-- published_source_runtime_expectations
-- ---------------------------------------------------------------------------

create table if not exists public.published_source_runtime_expectations (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  runtime_expectation_id text not null,
  visit_node_id text,
  procedure_node_id text,
  visit_id text,
  procedure_id text,
  required_status text,
  procedure_order integer,
  source_type text,
  conditionality jsonb not null default '{}'::jsonb,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint published_runtime_expectations_json_object check (
    jsonb_typeof (conditionality) = 'object'
    and jsonb_typeof (provenance_json) = 'object'
  ),
  constraint published_runtime_expectations_unique_per_package unique (
    organization_id,
    package_id,
    runtime_expectation_id
  ),
  constraint published_runtime_expectations_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists published_runtime_expectations_org_package_idx on public.published_source_runtime_expectations (organization_id, package_id);

create index if not exists published_runtime_expectations_visit_proc_idx on public.published_source_runtime_expectations (visit_id, procedure_id);

-- ---------------------------------------------------------------------------
-- immutability + RLS (same pattern as 0027)
-- ---------------------------------------------------------------------------

drop trigger if exists published_validation_rules_deny_mutation on public.published_source_validation_rules;

create trigger published_validation_rules_deny_mutation before update
or delete on public.published_source_validation_rules for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_conditional_rules_deny_mutation on public.published_source_conditional_rules;

create trigger published_conditional_rules_deny_mutation before update
or delete on public.published_source_conditional_rules for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_workflow_requirements_deny_mutation on public.published_source_workflow_requirements;

create trigger published_workflow_requirements_deny_mutation before update
or delete on public.published_source_workflow_requirements for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_signature_requirements_deny_mutation on public.published_source_signature_requirements;

create trigger published_signature_requirements_deny_mutation before update
or delete on public.published_source_signature_requirements for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_external_requirements_deny_mutation on public.published_source_external_requirements;

create trigger published_external_requirements_deny_mutation before update
or delete on public.published_source_external_requirements for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

drop trigger if exists published_runtime_expectations_deny_mutation on public.published_source_runtime_expectations;

create trigger published_runtime_expectations_deny_mutation before update
or delete on public.published_source_runtime_expectations for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

alter table public.published_source_validation_rules enable row level security;

alter table public.published_source_conditional_rules enable row level security;

alter table public.published_source_workflow_requirements enable row level security;

alter table public.published_source_signature_requirements enable row level security;

alter table public.published_source_external_requirements enable row level security;

alter table public.published_source_runtime_expectations enable row level security;

-- Macro-style policies per table via DO block would be heavy; explicit policies:

drop policy if exists published_validation_rules_select on public.published_source_validation_rules;

create policy published_validation_rules_select on public.published_source_validation_rules for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_validation_rules.organization_id
        and spp.package_id = published_source_validation_rules.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_validation_rules_insert on public.published_source_validation_rules;

create policy published_validation_rules_insert on public.published_source_validation_rules for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_validation_rules.organization_id
        and spp.package_id = published_source_validation_rules.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );

drop policy if exists published_conditional_rules_select on public.published_source_conditional_rules;

create policy published_conditional_rules_select on public.published_source_conditional_rules for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_conditional_rules.organization_id
        and spp.package_id = published_source_conditional_rules.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_conditional_rules_insert on public.published_source_conditional_rules;

create policy published_conditional_rules_insert on public.published_source_conditional_rules for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_conditional_rules.organization_id
        and spp.package_id = published_source_conditional_rules.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );

drop policy if exists published_workflow_requirements_select on public.published_source_workflow_requirements;

create policy published_workflow_requirements_select on public.published_source_workflow_requirements for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_workflow_requirements.organization_id
        and spp.package_id = published_source_workflow_requirements.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_workflow_requirements_insert on public.published_source_workflow_requirements;

create policy published_workflow_requirements_insert on public.published_source_workflow_requirements for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_workflow_requirements.organization_id
        and spp.package_id = published_source_workflow_requirements.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );

drop policy if exists published_signature_requirements_select on public.published_source_signature_requirements;

create policy published_signature_requirements_select on public.published_source_signature_requirements for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_signature_requirements.organization_id
        and spp.package_id = published_source_signature_requirements.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_signature_requirements_insert on public.published_source_signature_requirements;

create policy published_signature_requirements_insert on public.published_source_signature_requirements for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_signature_requirements.organization_id
        and spp.package_id = published_source_signature_requirements.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );

drop policy if exists published_external_requirements_select on public.published_source_external_requirements;

create policy published_external_requirements_select on public.published_source_external_requirements for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_external_requirements.organization_id
        and spp.package_id = published_source_external_requirements.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_external_requirements_insert on public.published_source_external_requirements;

create policy published_external_requirements_insert on public.published_source_external_requirements for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_external_requirements.organization_id
        and spp.package_id = published_source_external_requirements.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );

drop policy if exists published_runtime_expectations_select on public.published_source_runtime_expectations;

create policy published_runtime_expectations_select on public.published_source_runtime_expectations for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_runtime_expectations.organization_id
        and spp.package_id = published_source_runtime_expectations.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists published_runtime_expectations_insert on public.published_source_runtime_expectations;

create policy published_runtime_expectations_insert on public.published_source_runtime_expectations for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select 1
      from public.source_publish_packages spp
      where spp.organization_id = published_source_runtime_expectations.organization_id
        and spp.package_id = published_source_runtime_expectations.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
  );
