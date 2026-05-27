-- K2: Source Blueprint Evidence Layer (retrieval → structured evidence, coordinator review)
-- RLS: K1 pattern — user_has_active_organization_membership + user_has_study_access only.

-- ---------------------------------------------------------------------------
-- source_blueprint_evidence
-- ---------------------------------------------------------------------------

create table if not exists public.source_blueprint_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  intelligence_document_id uuid not null references public.document_intelligence_documents (id) on delete cascade,
  intelligence_chunk_id uuid not null references public.document_intelligence_chunks (id) on delete cascade,
  compliance_document_id uuid not null references public.compliance_runtime_documents (id) on delete restrict,
  usage_domain text not null,
  evidence_kind text not null,
  evidence_status text not null default 'pending_review',
  title text not null,
  summary text not null,
  excerpt_text text not null,
  structured_payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,2) null,
  -- Coordinator association only; does not store or mutate blueprint content.
  mapped_procedure_library_id uuid null references public.procedure_library (id) on delete set null,
  mapped_blueprint_version_id uuid null references public.procedure_blueprint_versions (id) on delete set null,
  mapping_notes text null,
  reviewed_by uuid null references auth.users (id) on delete set null,
  reviewed_at timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint source_blueprint_evidence_usage_domain_check check (
    usage_domain in (
      'source_creation',
      'budget_analysis',
      'contract_analysis',
      'regulatory_binder',
      'training',
      'delegation',
      'procedure_library',
      'general_library'
    )
  ),
  constraint source_blueprint_evidence_kind_check check (
    evidence_kind in (
      'procedure_generation',
      'source_drafting',
      'timing_rule',
      'visit_window',
      'safety_workflow',
      'billing_hint',
      'lab_handling'
    )
  ),
  constraint source_blueprint_evidence_status_check check (
    evidence_status in (
      'pending_review',
      'accepted',
      'rejected',
      'mapped',
      'archived',
      'superseded'
    )
  ),
  constraint source_blueprint_evidence_chunk_kind_unique unique (intelligence_chunk_id, evidence_kind)
);

create index if not exists source_blueprint_evidence_org_idx
  on public.source_blueprint_evidence (organization_id);
create index if not exists source_blueprint_evidence_study_idx
  on public.source_blueprint_evidence (study_id);
create index if not exists source_blueprint_evidence_intelligence_doc_idx
  on public.source_blueprint_evidence (intelligence_document_id);
create index if not exists source_blueprint_evidence_chunk_idx
  on public.source_blueprint_evidence (intelligence_chunk_id);
create index if not exists source_blueprint_evidence_compliance_doc_idx
  on public.source_blueprint_evidence (compliance_document_id);
create index if not exists source_blueprint_evidence_usage_domain_idx
  on public.source_blueprint_evidence (usage_domain);
create index if not exists source_blueprint_evidence_kind_idx
  on public.source_blueprint_evidence (evidence_kind);
create index if not exists source_blueprint_evidence_status_idx
  on public.source_blueprint_evidence (evidence_status);

create index if not exists source_blueprint_evidence_org_study_idx
  on public.source_blueprint_evidence (organization_id, study_id);

create index if not exists source_blueprint_evidence_study_status_idx
  on public.source_blueprint_evidence (study_id, evidence_status);

create index if not exists source_blueprint_evidence_study_kind_pending_idx
  on public.source_blueprint_evidence (study_id, evidence_kind)
  where evidence_status = 'pending_review';

drop trigger if exists source_blueprint_evidence_set_updated_at on public.source_blueprint_evidence;
create trigger source_blueprint_evidence_set_updated_at
before update on public.source_blueprint_evidence
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- source_blueprint_evidence_review_events (append-only audit)
-- ---------------------------------------------------------------------------

create table if not exists public.source_blueprint_evidence_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  evidence_id uuid not null references public.source_blueprint_evidence (id) on delete cascade,
  event_type text not null,
  actor_id uuid null references auth.users (id) on delete set null,
  event_timestamp timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint source_blueprint_evidence_review_events_type_check check (
    event_type in (
      'extracted',
      'submitted_for_review',
      'accepted',
      'rejected',
      'mapping_proposed',
      'mapped',
      'archived',
      'superseded'
    )
  )
);

create index if not exists source_blueprint_evidence_review_events_org_idx
  on public.source_blueprint_evidence_review_events (organization_id);
create index if not exists source_blueprint_evidence_review_events_study_idx
  on public.source_blueprint_evidence_review_events (study_id);
create index if not exists source_blueprint_evidence_review_events_evidence_idx
  on public.source_blueprint_evidence_review_events (evidence_id);
create index if not exists source_blueprint_evidence_review_events_type_idx
  on public.source_blueprint_evidence_review_events (event_type);

-- Deny mutation on review events (append-only)
create or replace function public.source_blueprint_evidence_review_events_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'source_blueprint_evidence_review_events is append-only';
end;
$$;

drop trigger if exists source_blueprint_evidence_review_events_deny_update
  on public.source_blueprint_evidence_review_events;
create trigger source_blueprint_evidence_review_events_deny_update
before update or delete on public.source_blueprint_evidence_review_events
for each row execute function public.source_blueprint_evidence_review_events_deny_mutation();

-- ---------------------------------------------------------------------------
-- RLS (K1 pattern — never organization_id = auth.uid())
-- ---------------------------------------------------------------------------

alter table public.source_blueprint_evidence enable row level security;
alter table public.source_blueprint_evidence_review_events enable row level security;

create policy source_blueprint_evidence_select on public.source_blueprint_evidence
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy source_blueprint_evidence_insert on public.source_blueprint_evidence
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy source_blueprint_evidence_update on public.source_blueprint_evidence
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy source_blueprint_evidence_review_events_select
  on public.source_blueprint_evidence_review_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy source_blueprint_evidence_review_events_insert
  on public.source_blueprint_evidence_review_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );
