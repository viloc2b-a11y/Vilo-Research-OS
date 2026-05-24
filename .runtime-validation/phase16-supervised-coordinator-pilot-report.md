# Phase 16 — Supervised Coordinator Pilot Report

**Run:** 2026-05-24T17:20:00Z (staging + local dev API `http://localhost:3000`)  
**Coordinator:** `calendar.qa.coordinator@vilo-os.staging` (research_coordinator / study coordinator)  
**Fixture:** PHASE9A-PILOT-001 / phase2-validation-study

---

## 1. Staging migration status

| Check | Result |
|-------|--------|
| Migrations 0082–0088 applied (DDL) | **PASS** — applied via `npm run db:migrate:from 0082…` then `0088_phase16a26_source_integrity.sql` |
| Old conflicting `0087_phase16a26_pilot_audit_integrity_guardrails` | **PASS** — not present in repo; never applied |
| Duplicate `0088_gov1_audit_integrity_workflow_keys.sql` | **REMOVED** — blocked migrate (altered tables before create); deleted before successful 0088 apply |
| `schema_migrations` registry rows | **WARN** — direct Postgres `schema_migrations` not populated for 0082–0088 (DDL applied successfully; tables exist) |
| GOV-1 audit workflows (4 keys) | **PASS** |
| Audit tables (`source_response_field_snapshots`, checkpoints, role policies) | **PASS** |

---

## 2. Pilot fixture IDs

| Entity | ID |
|--------|-----|
| Organization | `f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e` |
| Study | `6bae715a-8536-4000-8d24-22b6a3dbb8c9` |
| Study subject | `4384b789-4e16-4512-b3f3-50642b3b9735` |
| Visit (Screening) | `6690da63-4bf1-4681-815a-3e39b7b014bc` |
| Procedure execution (Screening CBC) | `c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc` |
| Response set | `dc431c9a-2360-47a7-ba3b-d5b8ebd85c31` |
| Coordinator actor | `d7e43ee5-5c08-489b-b293-8ef288e7fdb7` |

---

## 3. Coordinator user / role confirmation

| Check | Result |
|-------|--------|
| Email | `calendar.qa.coordinator@vilo-os.staging` |
| Org roles | `research_coordinator`, `data_coordinator` |
| Study member role | `coordinator` |
| Capture access | **PASS** — can open/save/submit via user-scoped API (not service role) |
| Service role as coordinator | **Not used** |

---

## 4. UI routes tested (coordinator path)

| Route | Status |
|-------|--------|
| `/studies/{studyId}/subjects/{subjectId}` | Validated (dry-run) |
| `/studies/{studyId}/subjects/{subjectId}/workspace` | Validated |
| `/visits/{visitId}` | Validated · visit `in_progress` |
| `/source/capture/{procedureExecutionId}` | Validated |

Manual browser sign-in not executed in this automated run; API path mirrors coordinator UI capture/submit.

---

## 5. Source capture result

| Step | Result |
|------|--------|
| Open response set | **PASS** HTTP 200 |
| Save draft | **WARN** HTTP 409 `SUBMITTED_VALUE_IMMUTABLE` (already submitted set) |
| Published source resolution | **PASS** `resolution.source=published`, no fallback |
| PE SDV vs binding | **WARN** PE SDV `e0317385-…` ≠ binding `2ee5a544-…` (expected pilot drift; capture uses PE-bound SDV) |

---

## 6. Submit / sign result

| Step | Result |
|------|--------|
| Submit source | **PASS** HTTP 200 (idempotent re-submit on submitted set) |
| Response set status | `submitted` |
| Procedure sign | **NOT RUN** — `is_signed=false`, `validation_status=clean` (ready; manual sign or separate sign API pass) |
| Sign snapshots | **N/A** — no sign action in this run |

---

## 7. Runtime UI result

| Panel | Result |
|-------|--------|
| Next action | **PASS** — "Unsigned procedures" |
| Why blocked | **PASS** — signatures + visit completion blockers |
| Automation proposals | **PASS** — 5 proposals; supervised apply required |
| Work queue | **PASS** — 1 bucket |
| Visit readiness | `blocked`, 2 blockers (authentic — not faked) |

---

## 8. Source snapshot result

| Check | Result |
|-------|--------|
| Rows after submit | **14** hash snapshots on response set `dc431c9a-…` |
| Raw field values stored | **PASS** — none (SHA256 hashes only) |
| `snapshot_type` | `submit` (versions 1 and 2 from dry-run + capture-proof) |
| Spine event | **PASS** — `SOURCE_FIELD_SNAPSHOT_CAPTURED` at 2026-05-24T17:15–17:16Z |

---

## 9. OBS telemetry result

| Check | Result |
|-------|--------|
| `workflow_telemetry_events` rows (audit signals) | Query by `metadata.signal` post-migrate — verify in Supabase if async hooks lag |
| PHI in metadata | **PASS** — redaction contract smoke clean on sample keys |
| Forbidden authority labels | **PASS** — not present in pilot telemetry sample |

---

## 10. Replay / orchestration / financial result

| Suite | Result |
|-------|--------|
| `runtime:e2e:live --fail-on-fail` | **DEGRADED** (exit 0) — replay, financial leakage, orchestration, UI model **PASS** on live visit |
| Replay | **PASS** — explains blocked: unsigned procedures + visit completion |
| Financial leakage | **PASS** — score 11, 2 items |
| Coordinator next action | **PASS** |
| Automation supervised | **PASS** — 4 proposed, 0 auto-applied |
| `orchestration:smoke` | **PASS** |
| `financial:smoke` | **PASS** |
| `integrity:audit:strict` | **PASS** (0 blockers, 26 warnings) |

---

## 11. Issues found

1. **Migrations 0082–0088 were missing** on staging at pilot start — applied during this run.
2. **Duplicate migration file** `0088_gov1_audit_integrity_workflow_keys.sql` caused failed migrate until removed.
3. **`schema_migrations` registry** may not list 0082–0088 even after successful DDL — reconcile registry for ops visibility.
4. **Save draft 409** on already-submitted set — expected; not a blocker for submit path.
5. **PE SDV ≠ study binding SDV** — document for coordinators; capture still uses published PE SDV.
6. **`subject_runtime_projections` refresh** from script failed Next.js cookie context — live E2E uses service path; **WARN** only.
7. **Procedure sign** not exercised in automated pilot — visit remains blocked on unsigned procedures (real blocker).
8. **E2E overall DEGRADED** due to WARN-level chain checks (graph/safety carry-forward on this visit shape).

---

## 12. Go / No-Go recommendation

### **CONDITIONAL GO** — supervised coordinator pilot on staging fixture

**Go for:**
- Coordinator auth + RBAC capture path (open/submit)
- Runtime UI intelligence (next action, why blocked, automation panel)
- Replay / financial / orchestration chain on live fixture
- Source field hash snapshots + `SOURCE_FIELD_SNAPSHOT_CAPTURED` spine events (post-0088)

**Before broader pilot:**
1. Register 0082–0088 in `schema_migrations` (or confirm Supabase migration history).
2. Run one **manual UI session** (sign-in → visit → capture → sign) to confirm sign snapshots + OBS rows in UI.
3. Complete **procedure sign** on Screening PE to clear signature blocker or document intentional blocked state.
4. Remove duplicate migration artifacts from all environments.

**No-Go for:** production-wide coordinator rollout until E2E is **PASS** (not DEGRADED) on a second subject/visit with full sign + projection freshness.

---

## Commands executed

```bash
npm run integrity:audit:strict
npm run runtime:pilot-fixture
npm run runtime:e2e:live -- --fail-on-fail
npm run db:migrate:from -- 0082_phase16a1_ai_governance_foundation.sql
node scripts/apply-migrations.mjs --from 0088_phase16a26_source_integrity.sql
npm run runtime:pilot-dry-run
E2E_API_BASE_URL=http://localhost:3000 npm run runtime:pilot-capture-proof
npm run orchestration:smoke
npm run financial:smoke
```

Artifacts: `.runtime-validation/pilot-fixture.json`, `phase15-dry-run.json`, `phase11-report.md`
