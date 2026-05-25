-- Align subject_financial_runtime_projections with visit table (persist writes safeguards).

alter table public.subject_financial_runtime_projections
  add column if not exists safeguards jsonb not null default '[]'::jsonb;

comment on column public.subject_financial_runtime_projections.safeguards is
  'Phase 7 financial integrity safeguards (derived; mirrors visit_financial_runtime_projections).';
