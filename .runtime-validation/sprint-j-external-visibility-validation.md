# Sprint J — External Visibility Layer
## Runtime Validation Report

**Validation ID:** sprint-j-external-visibility-validation-001  
**Date:** 2026-06-14  
**Status:** COMPLETE

---

## DoD Assessment

| Criterion | Status | Notes |
|---|---|---|
| DoD 1 — Coordinator Visible | PARTIAL | J1–J4 are engine/adapter/schema layers; UI integration is post-pilot scope (consistent with "Solo después de datos reales de pilot" gate) |
| DoD 2 — Subject Workspace | PASS | Privacy masking applies at export time for subject-level report types |
| DoD 3 — Workflow Backbone | PASS | No new action queues — J is a read-only output layer |
| DoD 4 — Command Center | PASS | No coordinator actions generated — external visibility is output only |
| DoD 5 — Pilot Evidence | PASS | This artifact |

---

## Tasks

### J1 — Export Privacy Engine

**Policy matrix** (`field-mask-policy.ts`):

| Role | Report type | Mask level |
|---|---|---|
| org_admin, pi | any | none |
| coordinator | financials | partial |
| cra | any | partial (PHI) |
| sponsor | subject_data | partial |
| sponsor | adverse_events | full |
| sponsor | financials | partial |
| auditor | financials | partial |
| read_only | any | full |

`maskRecord(record, policy)` replaces each field in `policy.maskedFields` with `'[REDACTED]'`.

**Audit trail** (`export_audit_log` table):
- `mask_level CHECK (none, partial, full)`
- `masked_fields text[]`
- `export_format CHECK (json, csv, pdf)`
- `actor_role`, `record_count`, `metadata jsonb`
- Indexes: org+date, actor+date, study+date

---

### J2 — Sponsor Visibility

`loadSponsorStudySummaries` returns de-identified study-level aggregates:
- Subject counts by enrollment_status (enrolled, screen_failed, completed)
- Visit counts by visit_status (active/scheduled, missed)
- Open deviation count (excludes resolved/closed)
- No PHI, no subject identifiers

4 parallel queries via `Promise.all` targeting: studies, study_subjects, visits, protocol_deviations.

---

### J3 — VIP Circuit Breaker

FSM states: `closed → open → half_open → closed`

| Config | Value |
|---|---|
| failureThreshold | 3 |
| recoveryWindowMs | 60,000 ms |
| halfOpenProbeLimit | 1 |

`fetchWithRetry` in `client.ts`:
1. Checks `circuitAllows(VIP_CIRCUIT_KEY)` — throws immediately if blocked
2. Calls `circuitSuccess()` on HTTP 2xx
3. Calls `circuitFailure()` on any catch (both network and HTTP error)
4. Logs circuit state at each step via `safeLogger`

---

### J4 — External Benchmarking

Industry reference sources:
- TransCelerate Benchmarking Initiative 2023
- CISCRP PERCEPTIONS & INSIGHTS Study 2022
- Medidata Rave Aggregate Metrics 2022

**Categories and sort direction:**

| Category | Direction |
|---|---|
| enrollment_rate | higher_is_better |
| screen_failure_rate | lower_is_better |
| visit_completion_rate | higher_is_better |
| data_query_rate | lower_is_better |
| deviation_rate | lower_is_better |
| protocol_compliance_rate | higher_is_better |
| site_activation_days | lower_is_better |

`buildSiteBenchmarkReport(input)` accepts partial input (any subset of categories), scores each, returns overall tier and outperforming/on_target/underperforming/critical counts.
