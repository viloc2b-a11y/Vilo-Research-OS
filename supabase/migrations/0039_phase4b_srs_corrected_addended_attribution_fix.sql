-- Phase 4B: separate post-submit change (corrected/addended) from review/sign attribution on source_response_sets.
-- Dependencies: 0020 source_response_sets, 0036 correction/addendum RPCs.
-- Does not alter Phase 3C / 0026–0038 / published_*.

-- ---------------------------------------------------------------------------
-- Replace overly broad attribution CHECKs (corrected/addended are not review states)
-- ---------------------------------------------------------------------------

alter table public.source_response_sets
drop constraint if exists source_response_sets_reviewed_attribution;

alter table public.source_response_sets
add constraint source_response_sets_reviewed_attribution check (
  status not in ('reviewed', 'signed')
  or (
    reviewed_by_user_id is not null
    and reviewed_at is not null
  )
);

comment on constraint source_response_sets_reviewed_attribution on public.source_response_sets is
  'Review lane attribution required only for reviewed/signed — not for corrected/addended post-submit changes.';

alter table public.source_response_sets
drop constraint if exists source_response_sets_signed_attribution;

alter table public.source_response_sets
add constraint source_response_sets_signed_attribution check (
  status <> 'signed'
  or (
    signed_by_user_id is not null
    and signed_at is not null
  )
);

comment on constraint source_response_sets_signed_attribution on public.source_response_sets is
  'Investigator sign-off attribution required only when status is signed.';

alter table public.source_response_sets
drop constraint if exists source_response_sets_locked_attribution;

alter table public.source_response_sets
add constraint source_response_sets_locked_attribution check (
  status <> 'locked'
  or (
    locked_by_user_id is not null
    and locked_at is not null
  )
);

comment on constraint source_response_sets_locked_attribution on public.source_response_sets is
  'Set-level lock attribution when status is locked; distinct from visit lock and from review/sign lanes.';

-- submitted_attribution unchanged: submitted/corrected/addended still require submit attribution when applicable.
