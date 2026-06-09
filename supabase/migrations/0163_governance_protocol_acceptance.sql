-- Governance Runtime v1: protocol PI acceptance support on protocol runtime versions.
-- Append-only operational signature requests still remain the source of signature events.

alter table public.protocol_runtime_versions
  add column if not exists pi_acceptance_signature_request_id uuid references public.operational_signature_requests (id) on delete set null,
  add column if not exists pi_acceptance_signature_id uuid references public.operational_signatures (id) on delete set null,
  add column if not exists pi_acceptance_status text not null default 'not_requested',
  add column if not exists pi_accepted_at timestamptz null,
  add column if not exists pi_accepted_by uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'protocol_runtime_versions_pi_acceptance_status_check'
  ) then
    alter table public.protocol_runtime_versions
      add constraint protocol_runtime_versions_pi_acceptance_status_check check (
        pi_acceptance_status in ('not_requested', 'pending', 'signed', 'voided', 'superseded')
      );
  end if;
end
$$;

create index if not exists protocol_runtime_versions_pi_acceptance_request_idx
  on public.protocol_runtime_versions (pi_acceptance_signature_request_id);

create index if not exists protocol_runtime_versions_pi_acceptance_status_idx
  on public.protocol_runtime_versions (pi_acceptance_status);

comment on column public.protocol_runtime_versions.pi_acceptance_status is
  'Governance runtime status for PI protocol acceptance on this protocol version.';
