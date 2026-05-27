-- Phase P4B: Use Published Source Package in Visit Runtime Execution

alter table public.visit_runtime_instances
  add column if not exists source_publication_id uuid null
    references public.runtime_source_package_publications (id) on delete set null;

alter table public.visit_runtime_instances
  add column if not exists source_publication_version integer null;

alter table public.visit_runtime_instances
  add column if not exists source_package_hash text null;

create index if not exists idx_visit_runtime_instances_source_publication_id
  on public.visit_runtime_instances (source_publication_id);

create index if not exists idx_visit_runtime_instances_source_publication_version
  on public.visit_runtime_instances (source_publication_version);

