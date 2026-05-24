# Phase 16A-2.5 — Pilot Compliance Guardrails

**Phase:** 16A-2.5  
**Status:** Guardrail foundations only (not full compliance modules)  
**Migration:** `supabase/migrations/0086_phase16a25_pilot_compliance_guardrails.sql`

## Why guardrails, not modules

Supervised coordinator pilot readiness requires **visible, auditable guardrails** that prevent invisible workarounds—without shipping full consent management, delegation logs, break-glass UI, or a condition engine. These tables and helpers are **foundations** callers can adopt incrementally before OBS-2 hooks and pilot go-live.

## 1. Temporal Consistency Engine v0

### Tables

- **`temporal_consistency_rules`** — Rule registry (`organization_id IS NULL` = global default; `scope=study_version` for protocol-specific rules later).
- **`temporal_consistency_evaluations`** — Append-only evaluation audit rows.

### Scope

| Scope | `study_version_id` | Use |
|-------|-------------------|-----|
| `global` | NULL | Platform defaults (seeded) |
| `study_version` | Required | Protocol-specific rules (e.g. IP administration post-lab windows) |

**Not seeded globally:** IP administration post-lab window rules must be added as **`study_version`** scoped rows per protocol.

### Evaluator v0 (`evaluateTemporalConsistencyRule`)

- Compares **provided** `event_a_value` / `event_b_value` timestamps only — **no automatic data fetch**.
- Supported constraints: `a_before_b`, `a_before_or_equal_b`, `a_after_b`, `a_after_or_equal_b`.
- Returns `not_applicable` for `a_within_window_of_b`, `a_not_before_b`, `a_not_after_b`, missing values, etc.
- Does **not** block runtime unless caller passes `enforce=true` on a failing rule with `system_blocking` + `severity=blocker`.
- `recordTemporalConsistencyEvaluation()` emits **`TEMPORAL_CONSISTENCY_EVALUATED`** on the operational spine.

### Seeded global rules

| `rule_key` | Constraint | Severity | `workflow_key` |
|------------|------------|----------|----------------|
| `consent_before_screening` | consent ≤ screening start | blocker | eligibility |
| `screening_before_enrollment` | screening ≤ enrolled | blocker | eligibility |
| `ae_onset_not_before_first_dose` | AE onset ≥ first dose | warning | ae_workflow |
| `lab_collection_before_lab_result` | collected ≤ resulted | blocker | lab_safety_escalation |
| `source_signature_after_capture` | signed ≥ captured | blocker | source_signing |

### Immutability

- `rule_key` immutable — deprecate with `active=false`.

## 2. Break-glass Access Foundation v0

### Table: `break_glass_access_events`

- Records **requests only** — no permission expansion in v0.
- **`approval_mode`:** v0 API accepts **`self_granted` only**; schema supports `dual_confirmed` for future dual-confirmation.
- **`justification`** required; must not contain PHI-like patterns.
- **`workflow_key`** required; record **`base_authority_level`** and **`effective_authority_level`** when known (GOV-1 enums).
- **`expires_at`** required; `post_review_required` defaults `true`.
- Emits **`BREAK_GLASS_ACCESS_REQUESTED`** on operational spine (requires `study_id` in v0).
- No silent break-glass — every request is a persisted row + spine event.

## 3. Delegation Runtime Check Foundation v0

### Tables

- **`procedure_delegation_requirements`** — Global (`organization_id` + `study_id` NULL) or study override.
- **`delegation_runtime_checks`** — Append-only check audit.

### Behavior (`checkDelegationRuntime`)

| Condition | Outcome |
|-----------|---------|
| No active requirement | `unknown` |
| Requirement + `delegated=true` | `delegated` |
| Requirement + `delegated=false` | `warning` (default) |
| `regulated` + `requires_pi_delegation` + `blocking_if_missing` + `enforce=true` | `blocked` |

- Does **not** invent delegation records or UI.
- No production procedure seeds — study-specific requirements via migration/admin only.
- `recordDelegationRuntimeCheck()` emits **`DELEGATION_RUNTIME_CHECKED`**.

## 4. Operational event types

| Event | Purpose |
|-------|---------|
| `TEMPORAL_CONSISTENCY_EVALUATED` | Spine record for temporal evaluation |
| `BREAK_GLASS_ACCESS_REQUESTED` | Spine record for break-glass request |
| `DELEGATION_RUNTIME_CHECKED` | Spine record for delegation check |

## 5. RLS summary

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| `temporal_consistency_rules` | Global + org members | Org governance admins | Org governance admins |
| `temporal_consistency_evaluations` | Org + study access | Org + study access | — (append-only) |
| `break_glass_access_events` | Org + study access | Org + study access | Governance admins (review) |
| `procedure_delegation_requirements` | Global + org | Governance admins | Governance admins |
| `delegation_runtime_checks` | Org + study access | Org + study access | — (append-only) |

Uses `user_can_manage_ai_governance()` for rule/requirement writes (org admin / study_admin pattern from GOV-0).

## 6. TypeScript modules

| Path | Role |
|------|------|
| `lib/temporal-consistency/` | Constants, evaluator, record evaluation |
| `lib/break-glass/` | Request validation + insert + spine |
| `lib/delegation-runtime/` | Resolve requirement, check, record check |

## 7. Out of scope

- Full condition / rules engine (beyond v0 date compare)
- Full delegation log UI
- Consent version tracking
- Amendment impact propagation
- Pre-monitoring snapshot
- Automatic break-glass permission expansion
- Dual-confirmation activation
- AI integration
- UI / dashboards
- Global runtime blocking (caller-enforced only)

## Smoke

```bash
npm run compliance:guardrails-smoke
```

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/phase16a25-pilot-compliance-guardrails-smoke.ts
git diff --check
```

Apply migration **`0086`** before using DB-backed helpers in staging/production.
