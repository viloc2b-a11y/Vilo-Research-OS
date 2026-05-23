-- H4 Phase 4: DB-Level Delete Protection Guards
-- Enforces logical deletion requirements by blocking physical deletes 
-- natively via Postgres triggers for visits, procedure_executions, 
-- source_response_sets, source_responses, and visit_progress_notes.

-- ---------------------------------------------------------------------------
-- 1. visits: Block DELETE unless scheduled
-- ---------------------------------------------------------------------------

create or replace function public.enforce_visit_delete_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.visit_status != 'scheduled' then
    raise exception 'Cannot delete visit with status %; use cancellation instead.', old.visit_status;
  end if;
  return old;
end;
$$;

drop trigger if exists visits_delete_guard on public.visits;

create trigger visits_delete_guard
before delete on public.visits
for each row execute function public.enforce_visit_delete_protection();

-- ---------------------------------------------------------------------------
-- 2. procedure_executions: Block DELETE unless pending
-- ---------------------------------------------------------------------------

create or replace function public.enforce_procedure_execution_delete_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.execution_status != 'pending' then
    raise exception 'Cannot delete procedure_execution with status %; use cancellation instead.', old.execution_status;
  end if;
  return old;
end;
$$;

drop trigger if exists procedure_executions_delete_guard on public.procedure_executions;

create trigger procedure_executions_delete_guard
before delete on public.procedure_executions
for each row execute function public.enforce_procedure_execution_delete_protection();

-- ---------------------------------------------------------------------------
-- 3. source_response_sets: Block DELETE unless draft or archived
-- ---------------------------------------------------------------------------

create or replace function public.enforce_source_response_sets_delete_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status not in ('draft', 'archived') then
    raise exception 'Cannot delete source_response_set with status %.', old.status;
  end if;
  return old;
end;
$$;

drop trigger if exists source_response_sets_delete_guard on public.source_response_sets;

create trigger source_response_sets_delete_guard
before delete on public.source_response_sets
for each row execute function public.enforce_source_response_sets_delete_protection();

-- ---------------------------------------------------------------------------
-- 4. source_responses: Block DELETE if submitted
-- ---------------------------------------------------------------------------

create or replace function public.enforce_source_responses_delete_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_submitted = true then
    raise exception 'Cannot delete submitted source responses; must use correction chain.';
  end if;
  return old;
end;
$$;

drop trigger if exists source_responses_delete_guard on public.source_responses;

create trigger source_responses_delete_guard
before delete on public.source_responses
for each row execute function public.enforce_source_responses_delete_protection();

-- ---------------------------------------------------------------------------
-- 5. visit_progress_notes: Block DELETE if signed
-- ---------------------------------------------------------------------------

create or replace function public.enforce_visit_progress_notes_delete_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.coordinator_signature_status = 'signed' then
    raise exception 'Cannot delete visit progress note after coordinator signature.';
  end if;
  
  if old.investigator_review_status = 'signed' then
    raise exception 'Cannot delete visit progress note after investigator signature.';
  end if;

  return old;
end;
$$;

drop trigger if exists visit_progress_notes_delete_guard on public.visit_progress_notes;

create trigger visit_progress_notes_delete_guard
before delete on public.visit_progress_notes
for each row execute function public.enforce_visit_progress_notes_delete_protection();
