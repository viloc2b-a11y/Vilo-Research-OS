-- Pharmacy Runtime Phase 1: transaction hardening RPCs.
-- The final receipt/correction commit boundary lives inside Postgres so partial
-- receipt, ledger, document, or correction writes cannot survive a failure.

create or replace function public.pharmacy_assert_signed_operational_signature(
  _signature_id uuid,
  _signature_request_id uuid,
  _organization_id uuid,
  _study_id uuid,
  _artifact_type text,
  _artifact_id uuid,
  _expected_artifact_hash text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Pharmacy commit requires authenticated actor';
  end if;

  if _signature_id is null or _signature_request_id is null then
    raise exception 'Pharmacy commit requires signed operational signature';
  end if;

  if not exists (
    select 1
    from public.operational_signature_requests r
    join public.operational_signatures s on s.request_id = r.id
    where r.id = _signature_request_id
      and s.id = _signature_id
      and r.organization_id = _organization_id
      and r.study_id = _study_id
      and s.organization_id = _organization_id
      and s.study_id = _study_id
      and r.artifact_type = _artifact_type
      and s.artifact_type = _artifact_type
      and r.artifact_id = _artifact_id
      and s.artifact_id = _artifact_id
      and r.status = 'signed'
      and s.status = 'signed'
      and s.signer_user_id = v_actor_id
      and (
        nullif(trim(coalesce(_expected_artifact_hash, '')), '') is null
        or s.signed_artifact_hash = _expected_artifact_hash
      )
  ) then
    raise exception 'Signed operational signature is missing or not bound to Pharmacy artifact context';
  end if;
end;
$$;

create or replace function public.pharmacy_payload_uuid(_payload jsonb, _key text, _required boolean default true)
returns uuid
language plpgsql
immutable
as $$
declare
  v_value text := nullif(trim(coalesce(_payload ->> _key, '')), '');
begin
  if v_value is null then
    if _required then
      raise exception 'Missing required Pharmacy payload key: %', _key;
    end if;
    return null;
  end if;

  return v_value::uuid;
end;
$$;

create or replace function public.pharmacy_payload_text(_payload jsonb, _key text, _required boolean default true)
returns text
language plpgsql
immutable
as $$
declare
  v_value text := nullif(trim(coalesce(_payload ->> _key, '')), '');
begin
  if v_value is null and _required then
    raise exception 'Missing required Pharmacy payload key: %', _key;
  end if;

  return v_value;
end;
$$;

create or replace function public.pharmacy_resolve_lot_id(
  _study_id uuid,
  _site_id uuid,
  _lot_id uuid,
  _lot_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot_id uuid;
begin
  if _lot_id is not null then
    return _lot_id;
  end if;

  select l.id
    into v_lot_id
  from public.ip_lots l
  where l.study_id = _study_id
    and (_site_id is null or l.site_id = _site_id or l.site_id is null)
    and l.manufacturer_lot_number = _lot_number
  order by case when l.site_id = _site_id then 0 else 1 end
  limit 1;

  if v_lot_id is null then
    raise exception 'No IP lot found for Pharmacy lot number %', _lot_number;
  end if;

  return v_lot_id;
end;
$$;

create or replace function public.commit_ip_receipt_with_signature(_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := public.pharmacy_payload_uuid(_payload, 'organization_id');
  v_study_id uuid := public.pharmacy_payload_uuid(_payload, 'study_id');
  v_site_id uuid := public.pharmacy_payload_uuid(_payload, 'site_id', false);
  v_blueprint_id uuid := public.pharmacy_payload_uuid(_payload, 'blueprint_id');
  v_receipt_id uuid := public.pharmacy_payload_uuid(_payload, 'receipt_id');
  v_shipment_id uuid := public.pharmacy_payload_uuid(_payload, 'shipment_id');
  v_signature_id uuid := public.pharmacy_payload_uuid(_payload, 'signature_id');
  v_signature_request_id uuid := public.pharmacy_payload_uuid(_payload, 'signature_request_id');
  v_status text := coalesce(public.pharmacy_payload_text(_payload, 'status', false), 'verified');
  v_received_at timestamptz := coalesce((_payload ->> 'received_at')::timestamptz, now());
  v_discrepancy_summary text := public.pharmacy_payload_text(_payload, 'discrepancy_summary', false);
  v_document_links jsonb := coalesce(_payload -> 'document_links', '[]'::jsonb);
  v_items jsonb := coalesce(_payload -> 'receipt_items', '[]'::jsonb);
  v_events jsonb := coalesce(_payload -> 'ledger_events', '[]'::jsonb);
  v_item jsonb;
  v_event jsonb;
  v_link jsonb;
  v_exception jsonb;
  v_lot_id uuid;
  v_event_id uuid;
  v_inserted_event_ids jsonb := '[]'::jsonb;
  v_inserted_document_ids jsonb := '[]'::jsonb;
  v_inserted_exception_ids jsonb := '[]'::jsonb;
  v_discrepant boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Pharmacy receipt commit requires authenticated actor';
  end if;

  if jsonb_typeof(_payload) is distinct from 'object' then
    raise exception 'Pharmacy receipt commit payload must be a JSON object';
  end if;

  if not public.pharmacy_blueprint_is_active(v_blueprint_id) then
    raise exception 'Cannot commit IP receipt without active Pharmacy Runtime Blueprint';
  end if;

  if not public.pharmacy_user_can_access_action(v_study_id, v_site_id, 'receipt') then
    raise exception 'Delegation/training gate failed for IP receipt commit';
  end if;

  perform public.pharmacy_assert_signed_operational_signature(
    v_signature_id,
    v_signature_request_id,
    v_organization_id,
    v_study_id,
    'ip_receipt',
    v_receipt_id,
    public.pharmacy_payload_text(_payload, 'expected_signature_hash', false)
  );

  if jsonb_array_length(v_items) = 0 then
    raise exception 'IP receipt commit requires at least one receipt item';
  end if;

  if jsonb_array_length(v_events) = 0 then
    raise exception 'IP receipt commit requires at least one ledger event';
  end if;

  if jsonb_array_length(v_document_links) = 0
    and public.pharmacy_payload_text(_payload, 'manual_exception_reason', false) is null then
    raise exception 'IP receipt commit requires evidence document linkage or manual exception justification';
  end if;

  insert into public.ip_receipts (
    id,
    organization_id,
    study_id,
    site_id,
    blueprint_id,
    shipment_id,
    received_by,
    received_at,
    status,
    discrepancy_summary,
    signature_id,
    metadata
  )
  values (
    v_receipt_id,
    v_organization_id,
    v_study_id,
    v_site_id,
    v_blueprint_id,
    v_shipment_id,
    v_actor_id,
    v_received_at,
    v_status,
    v_discrepancy_summary,
    v_signature_id,
    jsonb_build_object(
      'signature_request_id', v_signature_request_id,
      'transaction_hardened', true
    ) || coalesce(_payload -> 'metadata', '{}'::jsonb)
  );

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_lot_id := public.pharmacy_resolve_lot_id(
      v_study_id,
      v_site_id,
      public.pharmacy_payload_uuid(v_item, 'lot_id', false),
      public.pharmacy_payload_text(v_item, 'lot_number')
    );

    if public.pharmacy_payload_text(v_item, 'condition') <> 'intact' then
      v_discrepant := true;
    end if;

    insert into public.ip_receipt_items (
      organization_id,
      study_id,
      site_id,
      receipt_id,
      shipment_item_id,
      kit_id,
      lot_id,
      location_id,
      received_quantity,
      condition,
      discrepancy_reason
    )
    values (
      v_organization_id,
      v_study_id,
      v_site_id,
      v_receipt_id,
      public.pharmacy_payload_uuid(v_item, 'shipment_item_id', false),
      public.pharmacy_payload_uuid(v_item, 'kit_id', false),
      v_lot_id,
      public.pharmacy_payload_uuid(v_item, 'location_id', false),
      coalesce((v_item ->> 'received_quantity')::integer, 0),
      public.pharmacy_payload_text(v_item, 'condition'),
      public.pharmacy_payload_text(v_item, 'discrepancy_reason', false)
    );
  end loop;

  for v_event in select value from jsonb_array_elements(v_events)
  loop
    if public.pharmacy_payload_text(v_event, 'event_type') not in (
      'receipt_verified',
      'receipt_quarantined',
      'receipt_discrepancy_recorded'
    ) then
      raise exception 'Receipt commit event type is outside Phase 1 receipt scope';
    end if;

    v_event_id := coalesce(public.pharmacy_payload_uuid(v_event, 'event_id', false), gen_random_uuid());
    v_lot_id := public.pharmacy_resolve_lot_id(
      v_study_id,
      v_site_id,
      public.pharmacy_payload_uuid(v_event, 'lot_id', false),
      public.pharmacy_payload_text(v_event, 'lot_number')
    );

    if public.pharmacy_payload_text(v_event, 'event_type') in ('receipt_quarantined', 'receipt_discrepancy_recorded') then
      v_discrepant := true;
    end if;

    insert into public.ip_ledger_events (
      id,
      organization_id,
      study_id,
      site_id,
      blueprint_id,
      event_type,
      event_version,
      occurred_at,
      recorded_at,
      recorded_by,
      source_entity_type,
      source_entity_id,
      kit_id,
      lot_id,
      location_id,
      quantity_delta,
      status_delta,
      payload_json,
      reverses_event_id,
      supersedes_event_id,
      signature_id,
      record_hash
    )
    values (
      v_event_id,
      v_organization_id,
      v_study_id,
      v_site_id,
      v_blueprint_id,
      public.pharmacy_payload_text(v_event, 'event_type'),
      coalesce((v_event ->> 'event_version')::integer, 1),
      coalesce((v_event ->> 'occurred_at')::timestamptz, v_received_at),
      coalesce((v_event ->> 'recorded_at')::timestamptz, now()),
      v_actor_id,
      'receipt',
      v_receipt_id,
      public.pharmacy_payload_uuid(v_event, 'kit_id', false),
      v_lot_id,
      public.pharmacy_payload_uuid(v_event, 'location_id', false),
      coalesce((v_event ->> 'quantity_delta')::integer, 0),
      public.pharmacy_payload_text(v_event, 'status_delta'),
      coalesce(v_event -> 'payload_json', v_event -> 'payload', '{}'::jsonb),
      null,
      null,
      v_signature_id,
      public.pharmacy_payload_text(v_event, 'record_hash')
    );

    v_inserted_event_ids := v_inserted_event_ids || jsonb_build_array(v_event_id);
  end loop;

  if v_discrepant and jsonb_array_length(v_document_links) > 0 then
    if not exists (
      select 1
      from jsonb_array_elements(v_document_links) d
      where d ->> 'document_role' in ('discrepancy_evidence', 'quarantine_evidence', 'receipt_confirmation')
    ) then
      raise exception 'Discrepant or quarantined receipt requires discrepancy/quarantine evidence linkage';
    end if;
  end if;

  for v_link in select value from jsonb_array_elements(v_document_links)
  loop
    insert into public.ip_document_links (
      organization_id,
      study_id,
      site_id,
      entity_type,
      entity_id,
      document_id,
      document_reader_artifact_id,
      document_role,
      created_by
    )
    values (
      v_organization_id,
      v_study_id,
      v_site_id,
      'ip_receipt',
      v_receipt_id,
      public.pharmacy_payload_uuid(v_link, 'document_id'),
      public.pharmacy_payload_uuid(v_link, 'document_reader_artifact_id', false),
      public.pharmacy_payload_text(v_link, 'document_role'),
      v_actor_id
    )
    returning to_jsonb(id) into v_link;

    v_inserted_document_ids := v_inserted_document_ids || jsonb_build_array((v_link #>> '{}')::uuid);
  end loop;

  for v_exception in select value from jsonb_array_elements(coalesce(_payload -> 'accountability_exceptions', '[]'::jsonb))
  loop
    insert into public.ip_accountability_exceptions (
      organization_id,
      study_id,
      site_id,
      blueprint_id,
      source_receipt_id,
      source_ledger_event_id,
      exception_type,
      status,
      summary,
      opened_by,
      metadata
    )
    values (
      v_organization_id,
      v_study_id,
      v_site_id,
      v_blueprint_id,
      v_receipt_id,
      public.pharmacy_payload_uuid(v_exception, 'source_ledger_event_id', false),
      public.pharmacy_payload_text(v_exception, 'exception_type'),
      coalesce(public.pharmacy_payload_text(v_exception, 'status', false), 'open'),
      public.pharmacy_payload_text(v_exception, 'summary'),
      v_actor_id,
      coalesce(v_exception -> 'metadata', '{}'::jsonb)
    )
    returning to_jsonb(id) into v_exception;

    v_inserted_exception_ids := v_inserted_exception_ids || jsonb_build_array((v_exception #>> '{}')::uuid);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', v_receipt_id,
    'ledger_event_ids', v_inserted_event_ids,
    'document_link_ids', v_inserted_document_ids,
    'accountability_exception_ids', v_inserted_exception_ids,
    'signature_id', v_signature_id
  );
end;
$$;

create or replace function public.commit_ip_correction_with_signature(_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := public.pharmacy_payload_uuid(_payload, 'organization_id');
  v_study_id uuid := public.pharmacy_payload_uuid(_payload, 'study_id');
  v_site_id uuid := public.pharmacy_payload_uuid(_payload, 'site_id', false);
  v_blueprint_id uuid := public.pharmacy_payload_uuid(_payload, 'blueprint_id');
  v_correction_id uuid := public.pharmacy_payload_uuid(_payload, 'correction_id');
  v_target_event_id uuid := public.pharmacy_payload_uuid(_payload, 'target_event_id');
  v_signature_id uuid := public.pharmacy_payload_uuid(_payload, 'signature_id');
  v_signature_request_id uuid := public.pharmacy_payload_uuid(_payload, 'signature_request_id');
  v_scope text := public.pharmacy_payload_text(_payload, 'scope');
  v_reason text := public.pharmacy_payload_text(_payload, 'reason');
  v_justification text := public.pharmacy_payload_text(_payload, 'justification');
  v_document_links jsonb := coalesce(_payload -> 'document_links', '[]'::jsonb);
  v_events jsonb := coalesce(_payload -> 'ledger_events', '[]'::jsonb);
  v_target_event record;
  v_event jsonb;
  v_link jsonb;
  v_lot_id uuid;
  v_event_id uuid;
  v_reversal_event_id uuid;
  v_superseding_event_id uuid;
  v_inserted_document_ids jsonb := '[]'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'Pharmacy correction commit requires authenticated actor';
  end if;

  if jsonb_typeof(_payload) is distinct from 'object' then
    raise exception 'Pharmacy correction commit payload must be a JSON object';
  end if;

  if not public.pharmacy_blueprint_is_active(v_blueprint_id) then
    raise exception 'Cannot commit IP correction without active Pharmacy Runtime Blueprint';
  end if;

  if not public.pharmacy_user_can_access_action(v_study_id, v_site_id, 'correction') then
    raise exception 'Delegation/training gate failed for IP correction commit';
  end if;

  if v_scope not in ('receipt_event', 'inventory_foundation_event', 'accountability_foundation_event') then
    raise exception 'Correction scope is outside Phase 1 scope';
  end if;

  if length(trim(v_reason)) = 0 or length(trim(v_justification)) = 0 then
    raise exception 'Correction reason and justification are required';
  end if;

  select *
    into v_target_event
  from public.ip_ledger_events
  where id = v_target_event_id
    and study_id = v_study_id
    and (v_site_id is null or site_id = v_site_id);

  if not found then
    raise exception 'Target IP ledger event was not found for correction';
  end if;

  if v_target_event.event_type not in (
    'receipt_verified',
    'receipt_quarantined',
    'receipt_discrepancy_recorded',
    'inventory_location_assigned',
    'kit_quarantined'
  ) then
    raise exception 'Target IP ledger event is outside Phase 1 correction scope';
  end if;

  perform public.pharmacy_assert_signed_operational_signature(
    v_signature_id,
    v_signature_request_id,
    v_organization_id,
    v_study_id,
    'ip_correction',
    v_correction_id,
    public.pharmacy_payload_text(_payload, 'expected_signature_hash', false)
  );

  if jsonb_array_length(v_events) <> 2 then
    raise exception 'IP correction commit requires exactly reversal and superseding ledger events';
  end if;

  insert into public.ip_corrections (
    id,
    organization_id,
    study_id,
    site_id,
    target_event_id,
    scope,
    reason,
    justification,
    corrected_by,
    signature_id
  )
  values (
    v_correction_id,
    v_organization_id,
    v_study_id,
    v_site_id,
    v_target_event_id,
    v_scope,
    v_reason,
    v_justification,
    v_actor_id,
    v_signature_id
  );

  for v_event in select value from jsonb_array_elements(v_events)
  loop
    if public.pharmacy_payload_text(v_event, 'event_type') not in ('receipt_reversed', 'receipt_superseded') then
      raise exception 'Correction commit requires only reversal and superseding ledger events';
    end if;

    if public.pharmacy_payload_text(v_event, 'event_type') = 'receipt_reversed'
      and public.pharmacy_payload_uuid(v_event, 'reverses_event_id', false) is distinct from v_target_event_id then
      raise exception 'Correction reversal event must reference target event';
    end if;

    if public.pharmacy_payload_text(v_event, 'event_type') = 'receipt_superseded'
      and public.pharmacy_payload_uuid(v_event, 'supersedes_event_id', false) is distinct from v_target_event_id then
      raise exception 'Correction superseding event must reference target event';
    end if;

    v_event_id := coalesce(public.pharmacy_payload_uuid(v_event, 'event_id', false), gen_random_uuid());
    v_lot_id := public.pharmacy_resolve_lot_id(
      v_study_id,
      v_site_id,
      public.pharmacy_payload_uuid(v_event, 'lot_id', false),
      public.pharmacy_payload_text(v_event, 'lot_number')
    );

    insert into public.ip_ledger_events (
      id,
      organization_id,
      study_id,
      site_id,
      blueprint_id,
      event_type,
      event_version,
      occurred_at,
      recorded_at,
      recorded_by,
      source_entity_type,
      source_entity_id,
      kit_id,
      lot_id,
      location_id,
      quantity_delta,
      status_delta,
      payload_json,
      reverses_event_id,
      supersedes_event_id,
      signature_id,
      record_hash
    )
    values (
      v_event_id,
      v_organization_id,
      v_study_id,
      v_site_id,
      v_blueprint_id,
      public.pharmacy_payload_text(v_event, 'event_type'),
      coalesce((v_event ->> 'event_version')::integer, 1),
      coalesce((v_event ->> 'occurred_at')::timestamptz, now()),
      coalesce((v_event ->> 'recorded_at')::timestamptz, now()),
      v_actor_id,
      'correction',
      v_correction_id,
      public.pharmacy_payload_uuid(v_event, 'kit_id', false),
      v_lot_id,
      public.pharmacy_payload_uuid(v_event, 'location_id', false),
      coalesce((v_event ->> 'quantity_delta')::integer, 0),
      public.pharmacy_payload_text(v_event, 'status_delta'),
      coalesce(v_event -> 'payload_json', v_event -> 'payload', '{}'::jsonb),
      public.pharmacy_payload_uuid(v_event, 'reverses_event_id', false),
      public.pharmacy_payload_uuid(v_event, 'supersedes_event_id', false),
      v_signature_id,
      public.pharmacy_payload_text(v_event, 'record_hash')
    );

    if public.pharmacy_payload_text(v_event, 'event_type') = 'receipt_reversed' then
      v_reversal_event_id := v_event_id;
    else
      v_superseding_event_id := v_event_id;
    end if;
  end loop;

  if v_reversal_event_id is null or v_superseding_event_id is null then
    raise exception 'Correction commit must insert reversal and superseding events together';
  end if;

  update public.ip_corrections
  set reversal_event_id = v_reversal_event_id,
      superseding_event_id = v_superseding_event_id
  where id = v_correction_id;

  for v_link in select value from jsonb_array_elements(v_document_links)
  loop
    insert into public.ip_document_links (
      organization_id,
      study_id,
      site_id,
      entity_type,
      entity_id,
      document_id,
      document_reader_artifact_id,
      document_role,
      created_by
    )
    values (
      v_organization_id,
      v_study_id,
      v_site_id,
      'ip_correction',
      v_correction_id,
      public.pharmacy_payload_uuid(v_link, 'document_id'),
      public.pharmacy_payload_uuid(v_link, 'document_reader_artifact_id', false),
      public.pharmacy_payload_text(v_link, 'document_role'),
      v_actor_id
    )
    returning to_jsonb(id) into v_link;

    v_inserted_document_ids := v_inserted_document_ids || jsonb_build_array((v_link #>> '{}')::uuid);
  end loop;

  update public.ip_accountability_exceptions
  set status = coalesce(public.pharmacy_payload_text(_payload, 'accountability_exception_status', false), status),
      resolved_by = case
        when public.pharmacy_payload_text(_payload, 'accountability_exception_status', false) in ('resolved', 'closed')
        then v_actor_id
        else resolved_by
      end,
      resolved_at = case
        when public.pharmacy_payload_text(_payload, 'accountability_exception_status', false) in ('resolved', 'closed')
        then now()
        else resolved_at
      end,
      metadata = metadata || jsonb_build_object('correction_id', v_correction_id)
  where id = public.pharmacy_payload_uuid(_payload, 'accountability_exception_id', false);

  return jsonb_build_object(
    'ok', true,
    'correction_id', v_correction_id,
    'reversal_event_id', v_reversal_event_id,
    'superseding_event_id', v_superseding_event_id,
    'document_link_ids', v_inserted_document_ids,
    'signature_id', v_signature_id
  );
end;
$$;

revoke all on function public.pharmacy_assert_signed_operational_signature(uuid, uuid, uuid, uuid, text, uuid, text) from public;
revoke all on function public.commit_ip_receipt_with_signature(jsonb) from public;
revoke all on function public.commit_ip_correction_with_signature(jsonb) from public;

grant execute on function public.commit_ip_receipt_with_signature(jsonb) to authenticated;
grant execute on function public.commit_ip_correction_with_signature(jsonb) to authenticated;
