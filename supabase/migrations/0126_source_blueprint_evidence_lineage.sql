-- P4C: Source blueprint element lineage (evidence → blueprint elements, trace origins)
-- Does not mutate blueprint content. RLS: K1 membership + study access pattern.

-- ---------------------------------------------------------------------------
-- source_blueprint_evidence_lineage
-- ---------------------------------------------------------------------------

create table if not exists public.source_blueprint_evidence_lineage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  evidence_id uuid not null references public.source_blueprint_evidence (id) on delete cascade,
  blueprint_version_id uuid not null references public.procedure_blueprint_versions (id) on delete cascade,
  element_type text not null,
  element_key text not null,
  element_label text null,
  trace_origin text not null,
  coordinator_notes text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint source_blueprint_evidence_lineage_element_type_check check (
    element_type in (
      'source_section',
      'source_field',
      'signature_placeholder',
      'completion_rule',
      'validation_rule',
      'operational_instruction'
    )
  ),
  constraint source_blueprint_evidence_lineage_trace_origin_check check (
    trace_origin in (
      'procedure_blueprint',
      'runtime_graph',
      'protocol_evidence',
      'crf_guidance',
      'sop_manual_evidence',
      'manual_reconciliation_decision'
    )
  ),
  constraint source_blueprint_evidence_lineage_evidence_element_unique unique (
    evidence_id,
    element_type,
    element_key
  )
);

create index if not exists source_blueprint_evidence_lineage_org_idx
  on public.source_blueprint_evidence_lineage (organization_id);
create index if not exists source_blueprint_evidence_lineage_study_idx
  on public.source_blueprint_evidence_lineage (study_id);
create index if not exists source_blueprint_evidence_lineage_evidence_idx
  on public.source_blueprint_evidence_lineage (evidence_id);
create index if not exists source_blueprint_evidence_lineage_blueprint_idx
  on public.source_blueprint_evidence_lineage (blueprint_version_id);
create index if not exists source_blueprint_evidence_lineage_study_evidence_idx
  on public.source_blueprint_evidence_lineage (study_id, evidence_id);

-- ---------------------------------------------------------------------------
-- RLS (K1 pattern)
-- ---------------------------------------------------------------------------

alter table public.source_blueprint_evidence_lineage enable row level security;

drop policy if exists source_blueprint_evidence_lineage_select on public.source_blueprint_evidence_lineage;
create policy source_blueprint_evidence_lineage_select on public.source_blueprint_evidence_lineage
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_evidence_lineage_insert on public.source_blueprint_evidence_lineage;
create policy source_blueprint_evidence_lineage_insert on public.source_blueprint_evidence_lineage
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_evidence_lineage_update on public.source_blueprint_evidence_lineage;
create policy source_blueprint_evidence_lineage_update on public.source_blueprint_evidence_lineage
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_evidence_lineage_delete on public.source_blueprint_evidence_lineage;
create policy source_blueprint_evidence_lineage_delete on public.source_blueprint_evidence_lineage
  for delete using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );
