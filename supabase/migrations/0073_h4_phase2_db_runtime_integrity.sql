-- H4 Phase 2: DB-Level Runtime Integrity Guards
-- Enforces terminal state transitions and immutability natively via Postgres triggers.
-- Covers operational_events (append-only), visits (terminal state lockdowns), 
-- and procedure_executions (verified lockdowns and parent visit guard).

-- ---------------------------------------------------------------------------
-- 1. operational_events: True append-only enforcement
-- ---------------------------------------------------------------------------

create or replace function public.enforce_operational_events_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'operational_events are append-only and immutable';
end;
$$;

drop trigger if exists operational_events_immutability_guard on public.operational_events;

create trigger operational_events_immutability_guard
before update or delete on public.operational_events
for each row execute function public.enforce_operational_events_immutability();


-- ---------------------------------------------------------------------------
-- 2. visits: Enforce terminal state transitions
-- ---------------------------------------------------------------------------

create or replace function public.enforce_visit_runtime_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- Block transitions out of terminal states
    if old.visit_status in ('locked', 'cancelled', 'no_show') and new.visit_status is distinct from old.visit_status then
      raise exception 'visit_status % is terminal and cannot be changed', old.visit_status;
    end if;

    -- Block completed transitioning to anything but locked
    if old.visit_status = 'completed' and new.visit_status not in ('completed', 'locked') then
      raise exception 'visit_status completed can only transition to locked';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists visits_runtime_guard on public.visits;

create trigger visits_runtime_guard
before update on public.visits
for each row execute function public.enforce_visit_runtime_transitions();


-- ---------------------------------------------------------------------------
-- 3. procedure_executions: Terminal states and parent visit guards
-- ---------------------------------------------------------------------------

create or replace function public.enforce_procedure_execution_runtime_guards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit_status text;
begin
  if tg_op = 'UPDATE' then
    -- Verified state is terminal
    if old.execution_status = 'verified' and new.execution_status is distinct from old.execution_status then
      raise exception 'verified procedure executions are immutable';
    end if;

    select visit_status into v_visit_status from public.visits where id = new.visit_id;

    -- Block mutations when visit is in terminal state
    if v_visit_status in ('locked', 'cancelled', 'no_show') then
      raise exception 'cannot mutate procedure execution because visit is %', v_visit_status;
    end if;

    -- Block non-verification mutations when visit is completed
    -- Note: lock_visit RPC promotes completed -> verified while visit is completed.
    if v_visit_status = 'completed' then
      if not (old.execution_status = 'completed' and new.execution_status = 'verified') then
        raise exception 'only verification is allowed when visit is completed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists procedure_executions_runtime_guard on public.procedure_executions;

create trigger procedure_executions_runtime_guard
before update on public.procedure_executions
for each row execute function public.enforce_procedure_execution_runtime_guards();
