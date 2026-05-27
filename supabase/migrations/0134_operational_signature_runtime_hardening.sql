-- K5 hardening: org/study scope consistency and duplicate pending request guard.

create unique index if not exists operational_signature_requests_pending_unique_idx
  on public.operational_signature_requests (
    organization_id,
    study_id,
    artifact_type,
    artifact_id,
    required_role,
    signature_meaning
  )
  where status = 'pending';

create or replace function public.operational_signature_assert_study_org_scope(
  p_organization_id uuid,
  p_study_id uuid
)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.studies s
    where s.id = p_study_id
      and s.organization_id = p_organization_id
  ) then
    raise exception 'operational signature study does not belong to organization';
  end if;
end;
$$;

create or replace function public.operational_signature_requests_validate_scope()
returns trigger
language plpgsql
as $$
begin
  perform public.operational_signature_assert_study_org_scope(new.organization_id, new.study_id);
  return new;
end;
$$;

drop trigger if exists operational_signature_requests_validate_scope
  on public.operational_signature_requests;
create trigger operational_signature_requests_validate_scope
before insert or update on public.operational_signature_requests
for each row execute function public.operational_signature_requests_validate_scope();

create or replace function public.operational_signatures_validate_scope()
returns trigger
language plpgsql
as $$
begin
  perform public.operational_signature_assert_study_org_scope(new.organization_id, new.study_id);
  if not exists (
    select 1
    from public.operational_signature_requests r
    where r.id = new.request_id
      and r.organization_id = new.organization_id
      and r.study_id = new.study_id
  ) then
    raise exception 'operational signature request scope does not match signature scope';
  end if;
  return new;
end;
$$;

drop trigger if exists operational_signatures_validate_scope
  on public.operational_signatures;
create trigger operational_signatures_validate_scope
before insert or update on public.operational_signatures
for each row execute function public.operational_signatures_validate_scope();

create or replace function public.operational_signature_events_validate_scope()
returns trigger
language plpgsql
as $$
begin
  perform public.operational_signature_assert_study_org_scope(new.organization_id, new.study_id);
  if new.request_id is not null and not exists (
    select 1
    from public.operational_signature_requests r
    where r.id = new.request_id
      and r.organization_id = new.organization_id
      and r.study_id = new.study_id
  ) then
    raise exception 'operational signature request scope does not match event scope';
  end if;
  if new.signature_id is not null and not exists (
    select 1
    from public.operational_signatures s
    where s.id = new.signature_id
      and s.organization_id = new.organization_id
      and s.study_id = new.study_id
  ) then
    raise exception 'operational signature row scope does not match event scope';
  end if;
  return new;
end;
$$;

drop trigger if exists operational_signature_events_validate_scope
  on public.operational_signature_events;
create trigger operational_signature_events_validate_scope
before insert or update on public.operational_signature_events
for each row execute function public.operational_signature_events_validate_scope();
