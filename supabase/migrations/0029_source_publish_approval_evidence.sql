-- Phase 4C.9: source_publish_approval_evidence — frozen human approval at persist time.
-- Dependencies: 0026 source_publish_packages.

create table if not exists public.source_publish_approval_evidence (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id text not null,
  approval_id text not null,
  reviewer_user_id uuid references auth.users (id),
  reviewer_role text,
  decision text not null,
  reason text not null,
  comments text,
  reviewed_at timestamptz not null,
  source_definitions_hash text not null,
  preview_hash text not null,
  approval_hash text not null,
  validation_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),
  constraint source_publish_approval_evidence_decision_allowed check (
    decision in ('approved', 'rejected', 'needs_changes')
  ),
  constraint source_publish_approval_evidence_reason_non_blank check (
    length(
      trim(
        both
        from
          reason
      )
    ) > 0
  ),
  constraint source_publish_approval_evidence_snapshot_object check (
    jsonb_typeof (validation_snapshot_json) = 'object'
  ),
  constraint source_publish_approval_evidence_unique unique (
    organization_id,
    package_id,
    approval_id
  ),
  constraint source_publish_approval_evidence_fk_package foreign key (organization_id, package_id) references public.source_publish_packages (organization_id, package_id) on delete restrict
);

create index if not exists source_publish_approval_evidence_org_package_idx on public.source_publish_approval_evidence (organization_id, package_id);

comment on table public.source_publish_approval_evidence is
  'Immutable approval evidence copied from file-based source_preview_approval artifact at persist. Only decision=approved rows accompany successful publish.';

comment on column public.source_publish_approval_evidence.decision is
  'Must be approved for publish persistence path; enforced by phase4c_assert_publish_package_eligible.';

drop trigger if exists source_publish_approval_evidence_deny_mutation on public.source_publish_approval_evidence;

create trigger source_publish_approval_evidence_deny_mutation before update
or delete on public.source_publish_approval_evidence for each row
execute function public.phase4c_published_snapshot_deny_mutation ();

alter table public.source_publish_approval_evidence enable row level security;

drop policy if exists source_publish_approval_evidence_select on public.source_publish_approval_evidence;

create policy source_publish_approval_evidence_select on public.source_publish_approval_evidence for
select
  using (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select
        1
      from
        public.source_publish_packages spp
      where
        spp.organization_id = source_publish_approval_evidence.organization_id
        and spp.package_id = source_publish_approval_evidence.package_id
        and (
          public.user_is_org_admin (spp.organization_id)
          or public.user_has_study_access (spp.study_id)
        )
    )
  );

drop policy if exists source_publish_approval_evidence_insert on public.source_publish_approval_evidence;

create policy source_publish_approval_evidence_insert on public.source_publish_approval_evidence for insert
with
  check (
    organization_id in (
      select public.user_organization_ids ()
    )
    and exists (
      select
        1
      from
        public.source_publish_packages spp
      where
        spp.organization_id = source_publish_approval_evidence.organization_id
        and spp.package_id = source_publish_approval_evidence.package_id
        and public.phase4c_user_can_publish_source_package (spp.organization_id, spp.study_id)
    )
    and decision = 'approved'
  );
