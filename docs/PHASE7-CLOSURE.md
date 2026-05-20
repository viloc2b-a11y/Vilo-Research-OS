# Phase 7 — VPI Closure (A + B + C + E)

**Status:** Implementation complete in repo. Live QA deferred until operational data exists in staging.

**Master plan:** [`VPI-PRODUCTION-PLAN.md`](./VPI-PRODUCTION-PLAN.md)

---

## Completed phases

| Phase | Doc | What shipped |
|-------|-----|----------------|
| **7A** | [PHASE7A-READ-LAYER.md](./PHASE7A-READ-LAYER.md) | `lib/performance/read-layer/`, thin `performance-read-model` facade |
| **7B** | [PHASE7B-SQL-AGGREGATION.md](./PHASE7B-SQL-AGGREGATION.md) | `0053_phase7b_vpi_sql_aggregation.sql`, `vpi_load_dashboard()` RPC |
| **7C** | [PHASE7C-SCORING-LITE.md](./PHASE7C-SCORING-LITE.md) | `lib/performance/scoring/`, deduped risk queue, study/subject states |
| **7E** | [PHASE7E-COMMAND-CENTER-MINIMAL.md](./PHASE7E-COMMAND-CENTER-MINIMAL.md) | `/performance`, `/performance/today`, `/performance/risks` |

---

## Validation (no live data required)

```bash
npm run db:validate-phase7-vpi
npx tsc --noEmit
npm run build
```

Individual validators:

```bash
npm run db:validate-phase7a-read-layer
npm run db:validate-phase7b-vpi-views   # live catalog checks need DATABASE_URL + migration 0053
npm run db:validate-phase7c-scoring
npm run db:validate-phase7e-command-minimal
```

---

## Environment

```env
VPI_USE_RPC=true          # prefer vpi_load_dashboard; auto-fallback to signal reads on error
VPI_SCORING_ENABLED=true  # reserved; scoring on by default when unset
```

Apply migration before enabling RPC in an environment:

```bash
npm run db:migrate:phase7b
# or: node scripts/apply-migrations.mjs --from 0053_phase7b_vpi_sql_aggregation.sql
```

---

## Deferred — do not build until triggers in plan §7

| Phase | Trigger (summary) |
|-------|-------------------|
| **D** Snapshots & trends | ≥ 3 months `vpi_load_dashboard` in prod with daily use |
| **F** Persistent alerts | Slack/email channel exists |
| **G** Sponsor-facing | `sponsors` entity + 2+ external sponsors need reporting |
| **H** Benchmark / ecosystem | ClinIQ + VITALIS data ingest |

---

## Optional follow-up (not blocking closure)

| Item | Notes |
|------|--------|
| **7B.1** `visit_snapshot` in RPC JSON | Removes extra `loadVisitSnapshot` round-trip in RPC mode |
| **Live smoke test** | When studies/subjects/visits exist: walk Portfolio, Today, Risks with `VPI_USE_RPC=true` |
| **Owner display names** | `coordinator_load` rows use UUID labels until profile join exists |
| **PR / merge** | Single PR or split A→B→C→E per team preference |

---

## Staging validation runbook (operational go-live)

```bash
# 1. Migration (idempotent)
npm run db:migrate:phase7b

# 2. Live catalog
npm run db:validate-phase7b-vpi-views

# 3. Synthetic users/orgs (not clinical seed)
npm run db:provision

# 3b. VPI risk scenarios (staging only — missed visit, blocked proc, overdue workflow)
npm run db:seed-vpi-risk-scenarios

# 4. RPC shape + data volume check
npm run db:validate-phase7a-staging-snapshot

# 5. Performance (P95 < 800ms on vpi_load_dashboard)
npm run db:benchmark-vpi-staging

# 6. Visual 7E (manual, logged-in synthetic or real user)
#    /performance  /performance/today  /performance/risks
```

`db:provision` creates auth + organizations only. **Studies/subjects/visits** must exist separately for meaningful 7E UI and non-zero risk signals.

### Staging run log (2026-05-18)

| Step | Command | Result |
|------|---------|--------|
| 1 | `npm run db:migrate:phase7b` | OK (idempotent; 0053 already applied) |
| 2 | `npm run db:validate-phase7b-vpi-views` | **23/23 PASS** (live catalog) |
| 3 | `npm run db:provision` | OK (synthetic users + 2 orgs) |
| 3b | `npm run db:seed-vpi-risk-scenarios` | OK — subject `VPI-STAGING-RISK-01`, **3 VPI signals** |
| 4 | `npm run db:validate-phase7a-staging-snapshot` | **9/9 PASS** — **3 risk signals**, 22+ visits |
| 5 | `npm run db:benchmark-vpi-staging` | **P95 &lt; 800ms** (see post-seed run below) |
| 6 | Visual 7E | **Ready for manual** — login `synthetic.staff.a@vilo-os.staging` |

**Post-seed snapshot (2026-05-18):** `subject_risk_signals_rows: 3` (`missed_visit`, `blocked_procedure`, `overdue_action`). Study: *Phase 2 Validation Study* in Synthetic Site Alpha.

**Seed markers (idempotent):** visit defs `VPI_SEED_MISSED` / `VPI_SEED_HOST`, procedure `VPI_SEED_BLOCKED`, workflow title `[VPI_SEED] Overdue coordinator action`.

---

## Live QA checklist (run when data exists)

- [ ] `/performance` — portfolio banner counts match study cards
- [ ] `/performance` — study health table shows non-healthy states when signals exist
- [ ] `/performance/today` — inbox groups critical / risk / watch
- [ ] `/performance/risks` — coordinator load rows (or empty state without error)
- [ ] Study filter `?studyId=` scopes all three views
- [ ] RPC failure → fallback path still renders `partial` or `ok`, not hard `error` from UI logic

---

## Definition of done (this cycle)

1. ✅ Code for A, B, C-lite, E-mínima in repo  
2. ✅ Phase docs + this closure note  
3. ✅ Consolidated validator `db:validate-phase7-vpi`  
4. ⏸ Staging smoke with real signals — **blocked on data** (prudent to wait)  
5. ⏸ PR merge — team action  
