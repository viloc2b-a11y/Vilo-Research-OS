-- Document Intelligence: exact active-reference semantics + atomic setter

alter table public.document_intelligence_active_references
  add column if not exists is_active_reference boolean not null default true;

update public.document_intelligence_active_references
set is_active_reference = true
where is_active_reference is distinct from true;

alter table public.document_intelligence_active_references
  drop constraint if exists document_intelligence_active_references_family_study_domain_unique;

create unique index if not exists document_intelligence_active_references_one_active_idx
  on public.document_intelligence_active_references (document_family_id, study_id, domain)
  where is_active_reference = true;

create index if not exists document_intelligence_active_references_active_doc_idx
  on public.document_intelligence_active_references (intelligence_document_id)
  where is_active_reference = true;

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
    and ar.domain = filter_domain
    and ar.is_active_reference = true
  limit 1;

  if prior_row.id is not null and prior_row.intelligence_document_id = new_intelligence_document_id then
    update public.document_intelligence_active_references
    set
      active_reference_set_by = actor_id,
      active_reference_set_at = now_ts,
      active_reference_reason = reason,
      is_active_reference = true
    where id = prior_row.id
    returning * into active_row;
  else
    update public.document_intelligence_active_references
    set is_active_reference = false
    where organization_id = filter_organization_id
      and study_id = filter_study_id
      and document_family_id = filter_document_family_id
      and domain = filter_domain
      and is_active_reference = true;

    insert into public.document_intelligence_active_references (
      organization_id,
      study_id,
      document_family_id,
      domain,
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

-- Search RPCs: default active-reference only and never return quarantined documents.
create or replace function public.match_document_intelligence_chunks(
  query_embedding vector (1536),
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null,
  filter_domain text default null,
  filter_include_superseded boolean default false
)
returns table (
  chunk_id uuid,
  intelligence_document_id uuid,
  compliance_document_id uuid,
  source_filename text,
  section_title text,
  page_number integer,
  clean_chunk_text text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.intelligence_document_id,
    c.compliance_document_id,
    d.source_filename,
    c.section_title,
    c.page_number,
    c.clean_chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_intelligence_chunks c
  inner join public.document_intelligence_documents d on d.id = c.intelligence_document_id
  where c.organization_id = filter_organization_id
    and c.study_id = filter_study_id
    and c.embedding is not null
    and c.embedding_status = 'embedded'
    and d.intelligence_status in ('ready', 'superseded', 'archived')
    and d.intelligence_status <> 'quarantine'
    and (filter_classification is null or d.document_classification = filter_classification)
    and (
      filter_domain is null
      or exists (
        select 1
        from public.document_intelligence_domains dom
        where dom.intelligence_document_id = c.intelligence_document_id
          and dom.domain = filter_domain
          and dom.status = 'active'
      )
    )
    and (
      filter_include_superseded = true
      or exists (
        select 1
        from public.document_intelligence_active_references ar
        where ar.intelligence_document_id = d.id
          and ar.organization_id = filter_organization_id
          and ar.study_id = filter_study_id
          and ar.is_active_reference = true
          and (
            filter_domain is null
            or ar.domain = filter_domain
          )
      )
    )
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.keyword_search_document_intelligence_chunks(
  search_query text,
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null,
  filter_domain text default null,
  filter_include_superseded boolean default false
)
returns table (
  chunk_id uuid,
  intelligence_document_id uuid,
  compliance_document_id uuid,
  source_filename text,
  section_title text,
  page_number integer,
  clean_chunk_text text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.intelligence_document_id,
    c.compliance_document_id,
    d.source_filename,
    c.section_title,
    c.page_number,
    c.clean_chunk_text,
    similarity(c.clean_chunk_text, search_query) as similarity
  from public.document_intelligence_chunks c
  inner join public.document_intelligence_documents d on d.id = c.intelligence_document_id
  where c.organization_id = filter_organization_id
    and c.study_id = filter_study_id
    and d.intelligence_status in ('ready', 'superseded', 'archived')
    and d.intelligence_status <> 'quarantine'
    and (filter_classification is null or d.document_classification = filter_classification)
    and search_query is not null
    and length(trim(search_query)) > 0
    and (
      filter_domain is null
      or exists (
        select 1
        from public.document_intelligence_domains dom
        where dom.intelligence_document_id = c.intelligence_document_id
          and dom.domain = filter_domain
          and dom.status = 'active'
      )
    )
    and (
      filter_include_superseded = true
      or exists (
        select 1
        from public.document_intelligence_active_references ar
        where ar.intelligence_document_id = d.id
          and ar.organization_id = filter_organization_id
          and ar.study_id = filter_study_id
          and ar.is_active_reference = true
          and (
            filter_domain is null
            or ar.domain = filter_domain
          )
      )
    )
    and (
      (
        c.clean_chunk_text % search_query
        and similarity(c.clean_chunk_text, search_query) >= 0.3
      )
      or c.clean_chunk_text ilike '%' || search_query || '%'
    )
  order by similarity(c.clean_chunk_text, search_query) desc nulls last
  limit greatest(match_count, 1);
$$;
