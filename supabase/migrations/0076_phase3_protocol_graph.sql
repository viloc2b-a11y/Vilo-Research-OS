-- Phase 3 — Protocol Graph Engine (executable graph over existing definition tables).
-- operational_events remain canonical chronology; graph publications are versioned orchestration snapshots.

create table if not exists public.protocol_graph_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_version_id uuid references public.study_versions (id) on delete set null,
  graph_revision int not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'superseded')),
  graph_schema_version int not null default 1,
  graph_document jsonb not null default '{}'::jsonb,
  source_checksum text,
  supersedes_publication_id uuid references public.protocol_graph_publications (id) on delete set null,
  amendment_summary jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (study_id, graph_revision)
);

create index if not exists protocol_graph_publications_study_status_idx
  on public.protocol_graph_publications (study_id, status, published_at desc nulls last);
create index if not exists protocol_graph_publications_version_idx
  on public.protocol_graph_publications (study_version_id)
  where study_version_id is not null;

create table if not exists public.protocol_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.protocol_graph_publications (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  node_key text not null,
  node_type text not null,
  entity_ref_type text,
  entity_ref_id uuid,
  properties jsonb not null default '{}'::jsonb,
  unique (publication_id, node_key)
);

create index if not exists protocol_graph_nodes_publication_idx
  on public.protocol_graph_nodes (publication_id);
create index if not exists protocol_graph_nodes_entity_idx
  on public.protocol_graph_nodes (entity_ref_type, entity_ref_id)
  where entity_ref_id is not null;

create table if not exists public.protocol_graph_edges (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.protocol_graph_publications (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  edge_key text not null,
  edge_type text not null,
  from_node_key text not null,
  to_node_key text not null,
  condition jsonb not null default '{}'::jsonb,
  properties jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  unique (publication_id, edge_key)
);

create index if not exists protocol_graph_edges_publication_idx
  on public.protocol_graph_edges (publication_id);
create index if not exists protocol_graph_edges_type_idx
  on public.protocol_graph_edges (publication_id, edge_type);

-- Active publication pointer per study (coordinator runtime resolution).
alter table public.studies
  add column if not exists active_protocol_graph_publication_id uuid
    references public.protocol_graph_publications (id) on delete set null;

comment on table public.protocol_graph_publications is
  'Phase 3: immutable published protocol graph snapshots (orchestration layer over visit/procedure definitions).';
comment on column public.studies.active_protocol_graph_publication_id is
  'Phase 3: currently active published graph for runtime orchestration.';

-- Org consistency on graph rows
create or replace function public.enforce_protocol_graph_row_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select s.organization_id into org from public.studies s where s.id = new.study_id;
  if org is null then
    raise exception 'study not found for study_id %', new.study_id;
  end if;
  if new.organization_id is distinct from org then
    new.organization_id := org;
  end if;
  return new;
end;
$$;

drop trigger if exists protocol_graph_publications_enforce_org on public.protocol_graph_publications;
create trigger protocol_graph_publications_enforce_org
before insert or update of organization_id, study_id on public.protocol_graph_publications
for each row execute function public.enforce_protocol_graph_row_org();

drop trigger if exists protocol_graph_nodes_enforce_org on public.protocol_graph_nodes;
create trigger protocol_graph_nodes_enforce_org
before insert or update of organization_id, study_id on public.protocol_graph_nodes
for each row execute function public.enforce_protocol_graph_row_org();

drop trigger if exists protocol_graph_edges_enforce_org on public.protocol_graph_edges;
create trigger protocol_graph_edges_enforce_org
before insert or update of organization_id, study_id on public.protocol_graph_edges
for each row execute function public.enforce_protocol_graph_row_org();

alter table public.protocol_graph_publications enable row level security;
alter table public.protocol_graph_nodes enable row level security;
alter table public.protocol_graph_edges enable row level security;

drop policy if exists protocol_graph_publications_select on public.protocol_graph_publications;
create policy protocol_graph_publications_select on public.protocol_graph_publications
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists protocol_graph_publications_insert on public.protocol_graph_publications;
create policy protocol_graph_publications_insert on public.protocol_graph_publications
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists protocol_graph_publications_update on public.protocol_graph_publications;
create policy protocol_graph_publications_update on public.protocol_graph_publications
for update using (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
) with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists protocol_graph_nodes_select on public.protocol_graph_nodes;
create policy protocol_graph_nodes_select on public.protocol_graph_nodes
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists protocol_graph_nodes_insert on public.protocol_graph_nodes;
create policy protocol_graph_nodes_insert on public.protocol_graph_nodes
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);

drop policy if exists protocol_graph_edges_select on public.protocol_graph_edges;
create policy protocol_graph_edges_select on public.protocol_graph_edges
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists protocol_graph_edges_insert on public.protocol_graph_edges;
create policy protocol_graph_edges_insert on public.protocol_graph_edges
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_edit_study_definitions(study_id)
);
