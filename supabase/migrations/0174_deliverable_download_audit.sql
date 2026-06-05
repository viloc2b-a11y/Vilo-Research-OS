-- Persist deliverable download handoff metadata on existing deliverable outputs.

alter table public.deliverable_run_outputs
  add column if not exists downloaded_by uuid null references auth.users(id) on delete set null,
  add column if not exists downloaded_at timestamptz null;

create index if not exists idx_deliverable_run_outputs_downloaded_at
  on public.deliverable_run_outputs(downloaded_at);

