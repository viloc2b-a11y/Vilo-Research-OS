-- K2/P4C closure alignment: active-reference domain + superseded-candidate evidence.

alter table public.document_intelligence_active_references
  add column if not exists active_reference_domain text null;

update public.document_intelligence_active_references
set active_reference_domain = domain
where active_reference_domain is null;

alter table public.document_intelligence_active_references
  drop constraint if exists document_intelligence_active_references_active_reference_domain_check;

alter table public.document_intelligence_active_references
  add constraint document_intelligence_active_references_active_reference_domain_check check (
    active_reference_domain is null
    or active_reference_domain in (
      'source_creation',
      'budget_analysis',
      'contract_analysis',
      'regulatory_binder',
      'training',
      'delegation',
      'procedure_library',
      'general_library'
    )
  );

create unique index if not exists document_intelligence_active_reference_domain_active_idx
  on public.document_intelligence_active_references (
    document_family_id,
    study_id,
    active_reference_domain
  )
  where is_active_reference = true;

create index if not exists document_intelligence_active_reference_domain_lookup_idx
  on public.document_intelligence_active_references (study_id, active_reference_domain)
  where is_active_reference = true;

alter table public.source_blueprint_evidence
  drop constraint if exists source_blueprint_evidence_status_check;

alter table public.source_blueprint_evidence
  add constraint source_blueprint_evidence_status_check check (
    evidence_status in (
      'pending_review',
      'accepted',
      'rejected',
      'mapped',
      'archived',
      'superseded_candidate',
      'superseded'
    )
  );

alter table public.source_blueprint_evidence_review_events
  drop constraint if exists source_blueprint_evidence_review_events_type_check;

alter table public.source_blueprint_evidence_review_events
  add constraint source_blueprint_evidence_review_events_type_check check (
    event_type in (
      'extracted',
      'submitted_for_review',
      'accepted',
      'rejected',
      'mapping_proposed',
      'mapped',
      'archived',
      'superseded_candidate',
      'superseded'
    )
  );

create index if not exists source_blueprint_evidence_superseded_candidate_idx
  on public.source_blueprint_evidence (study_id, usage_domain)
  where evidence_status = 'superseded_candidate';

create or replace function public.set_active_reference(
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_document_family_id uuid,
  filter_domain text,
  new_intelligence_document_id uuid,
  actor_id uuid default null,
  reason text default null
)
returns public.document_intelligence_active_references
language plpgsql
as $$
declare
  now_ts timestamptz := now();
  prior_row public.document_intelligence_active_references%rowtype;
  active_row public.document_intelligence_active_references%rowtype;
begin
  if not exists (
    select 1
    from public.document_intelligence_documents d
    where d.id = new_intelligence_document_id
      and d.organization_id = filter_organization_id
      and d.study_id = filter_study_id
      and d.document_family_id = filter_document_family_id
      and d.intelligence_status = 'ready'
  ) then
    raise exception 'Only ready document versions in the same family/study can be active references';
  end if;

  if not exists (
    select 1
    from public.document_intelligence_domains dom
    where dom.intelligence_document_id = new_intelligence_document_id
      and dom.organization_id = filter_organization_id
      and dom.study_id = filter_study_id
      and dom.domain = filter_domain
      and dom.status = 'active'
  ) then
    raise exception 'Document is not tagged for the requested active-reference domain';
  end if;

  select *
  into prior_row
  from public.document_intelligence_active_references ar
  where ar.organization_id = filter_organization_id
    and ar.study_id = filter_study_id
    and ar.document_family_id = filter_document_family_id
    and ar.active_reference_domain = filter_domain
    and ar.is_active_reference = true
  limit 1;

  if prior_row.id is not null and prior_row.intelligence_document_id = new_intelligence_document_id then
    update public.document_intelligence_active_references
    set
      active_reference_set_by = actor_id,
      active_reference_set_at = now_ts,
      active_reference_reason = reason,
      domain = filter_domain,
      active_reference_domain = filter_domain,
      is_active_reference = true
    where id = prior_row.id
    returning * into active_row;
  else
    update public.document_intelligence_active_references
    set is_active_reference = false
    where organization_id = filter_organization_id
      and study_id = filter_study_id
      and document_family_id = filter_document_family_id
      and active_reference_domain = filter_domain
      and is_active_reference = true;

    insert into public.document_intelligence_active_references (
      organization_id,
      study_id,
      document_family_id,
      domain,
      active_reference_domain,
      intelligence_document_id,
      active_reference_set_by,
      active_reference_set_at,
      active_reference_reason,
      is_active_reference
    )
    values (
      filter_organization_id,
      filter_study_id,
      filter_document_family_id,
      filter_domain,
      filter_domain,
      new_intelligence_document_id,
      actor_id,
      now_ts,
      reason,
      true
    )
    returning * into active_row;
  end if;

  insert into public.document_intelligence_active_reference_events (
    organization_id,
    study_id,
    document_family_id,
    domain,
    previous_intelligence_document_id,
    new_intelligence_document_id,
    actor_id,
    reason,
    event_payload
  )
  values (
    filter_organization_id,
    filter_study_id,
    filter_document_family_id,
    filter_domain,
    case when prior_row.id is null then null else prior_row.intelligence_document_id end,
    new_intelligence_document_id,
    actor_id,
    reason,
    jsonb_build_object(
      'runtime_mutated', false,
      'published_source_mutated', false,
      'reconciliation_mutated', false,
      'active_reference_domain', filter_domain,
      'affected_evidence_state', 'superseded_candidate',
      'atomic_function', 'set_active_reference'
    )
  );

  if prior_row.id is not null and prior_row.intelligence_document_id <> new_intelligence_document_id then
    update public.document_intelligence_documents
    set
      superseded_by_document_id = new_intelligence_document_id,
      superseded_reason = coalesce(reason, 'active_reference_changed'),
      effective_to = now_ts,
      updated_at = now_ts
    where id = prior_row.intelligence_document_id
      and organization_id = filter_organization_id;
  end if;

  update public.document_intelligence_documents
  set
    active_reference_set_by = actor_id,
    active_reference_set_at = now_ts,
    active_reference_reason = reason,
    effective_from = coalesce(effective_from, now_ts),
    effective_to = null,
    updated_at = now_ts
  where id = new_intelligence_document_id
    and organization_id = filter_organization_id;

  return active_row;
end;
$$;
