# Operational Spine — Phase 9A Staging Hygiene

**Status:** COMPLETE  
**Study:** `phase2-validation-study` (`6bae715a-8536-4000-8d24-22b6a3dbb8c9`)  
**Pilot subject:** `PHASE9A-PILOT-001` (`4384b789-4e16-4512-b3f3-50642b3b9735`)

## READY_FOR_EXECUTION proof

- Persisted publish package: `pkg_47e6c6186bb4` (validation warning — non-blocking)
- Package consistency RPC: **true**
- Required procedure source binding: **1** → SDV `2ee5a544-fba6-4edb-a5c1-61ba5e2eee00`
- Computed gate: **PASS** (see `node scripts/phase9a-staging-hygiene.mjs`)

## Hygiene corrections

| Action | Detail |
|--------|--------|
| Procedure binding | Upserted `procedure_source_bindings` for required Screening procedure |
| Legacy `SUBJ-P2VAL-001` | **21** duplicate Screening visits → `visit_status = cancelled`; kept canonical locked visit |
| Pilot subject | `PHASE9A-PILOT-001` → screening → enrolled → randomized with external IWRS fields |
| Visit schedule | **3** visits (one per visit definition), no duplicates |
| Staging columns | Ensured `randomization_date_time`, `external_iwrs_rtsm_reference` (migration 0066) |

## Duplicate visit resolution

Per `visit_definition_id`, keep the row with highest operational rank (locked > completed > in_progress > scheduled), cancel the rest. **No deletes** — audit trail preserved.

## Pilot chronology (active visits)

| Order | Visit | Code | Status |
|-------|-------|------|--------|
| 1 | Screening | `V_SCREENING` | scheduled |
| 2 | VPI seed — missed visit | `VPI_SEED_MISSED` | scheduled |
| 3 | VPI seed — blocked procedure host | `VPI_SEED_HOST` | scheduled |

**Coordinator path for Phase 9 rerun:** use **Screening** (`6690da63-4bf1-4681-815a-3e39b7b014bc`) for capture/signatures; avoid VPI seed visits unless testing validation blockers.

## Code patches (minimal)

- `lib/ops/command-center-read-model.ts` — remove invalid `opened` from incomplete-source filter
- `app/(ops)/studies/page.tsx` — remove fake filters / decorative pending actions; honest guidance line

## Re-run hygiene

```bash
node scripts/phase9a-staging-hygiene.mjs
node scripts/validate-operational-spine-phase9.mjs
```

Set `PHASE9_SUBJECT_ID=4384b789-4e16-4512-b3f3-50642b3b9735` for probe.

## Phase 9 rerun readiness

Staging is prepared for an **unguided coordinator session** on `phase2-validation-study` + `PHASE9A-PILOT-001`. Full E2E still requires a live UI pass (check-in, capture submit, signatures, closeout).
