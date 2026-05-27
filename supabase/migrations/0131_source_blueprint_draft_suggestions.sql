-- K3: Evidence-backed Blueprint Drafting suggestions.
-- Draft suggestions are advisory only. They never mutate runtime, reconciliation, or published source.

create table if not exists public.source_blueprint_draft_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  evidence_id uuid not null references public.source_blueprint_evidence (id) on delete cascade,
  suggestion_type text not null,
  suggestion_payload jsonb not null default '{}'::jsonb,
  suggestion_status text not null default 'draft',
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid null references auth.users (id) on delete set null,
  reviewed_at timestamptz null,
  review_notes text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint source_blueprint_draft_suggestions_type_check check (
    suggestion_type in (
      'source_section',
      'source_field',
      'completion_guidance',
      'validation_rule',
      'signature_placeholder',
      'operational_instruction'
    )
  ),
  constraint source_blueprint_draft_suggestions_status_check check (
    suggestion_status in (
      'draft',
      'accepted_for_manual_use',
      'rejected',
      'archived'
    )
  ),
  constraint source_blueprint_draft_suggestions_payload_object check (
    jsonb_typeof(suggestion_payload) = 'object'
  ),
  constraint source_blueprint_draft_suggestions_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists source_blueprint_draft_suggestions_org_idx
  on public.source_blueprint_draft_suggestions (organization_id);
create index if not exists source_blueprint_draft_suggestions_study_idx
  on public.source_blueprint_draft_suggestions (study_id);
create index if not exists source_blueprint_draft_suggestions_evidence_idx
  on public.source_blueprint_draft_suggestions (evidence_id);
create index if not exists source_blueprint_draft_suggestions_status_idx
  on public.source_blueprint_draft_suggestions (suggestion_status);
create index if not exists source_blueprint_draft_suggestions_type_idx
  on public.source_blueprint_draft_suggestions (suggestion_type);
create index if not exists source_blueprint_draft_suggestions_study_status_idx
  on public.source_blueprint_draft_suggestions (study_id, suggestion_status);

alter table public.source_blueprint_draft_suggestions enable row level security;

create policy source_blueprint_draft_suggestions_select
  on public.source_blueprint_draft_suggestions
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy source_blueprint_draft_suggestions_insert
  on public.source_blueprint_draft_suggestions
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy source_blueprint_draft_suggestions_update
  on public.source_blueprint_draft_suggestions
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );
