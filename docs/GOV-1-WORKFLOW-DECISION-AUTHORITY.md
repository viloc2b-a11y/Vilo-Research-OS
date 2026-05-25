# GOV-1 — Workflow Decision Authority Matrix

**Phase:** 16 (GOV-1)  
**Status:** Static Classification v1 + Conditional Escalation Schema Readiness v2  
**Migration:** `supabase/migrations/0083_phase16_gov1_workflow_decision_authority.sql`  
**TypeScript:** `lib/governance/workflow-authority/`

## 1. Core principle

**AI never modifies truth layers directly.**

AI may suggest, summarize, or route work, but regulated truth-layer changes (eligibility confirmation, randomization, source signing, visit lock, AE disposition, protocol deviation recording, etc.) require **human confirmation** and/or **system-enforced protocol gates**. The authority matrix classifies each workflow so runtime, automation, and future AI layers know the minimum authority posture before acting.

## 2. Authority levels (centralized constants only)

All authority levels and registry enums live in `lib/governance/workflow-authority/constants.ts`. **Do not use free-text authority names** in runtime, replay, or observability code.

| Constant (`WORKFLOW_AUTHORITY_LEVEL`) | Value | Meaning |
|-------------------------------------|-------|---------|
| `ASSISTIVE` | `assistive` | AI/automation may assist; humans or soft gates own outcomes. |
| `HUMAN_REQUIRED` | `human_required` | A qualified human must confirm before truth-layer mutation. |
| `SYSTEM_ENFORCED` | `system_enforced` | Protocol/runtime gates block progression until prerequisites are met. |

`effective_authority_level` uses the same closed enum (`EFFECTIVE_AUTHORITY_LEVEL` / `WorkflowAuthorityLevel`).

Workflow keys use `WORKFLOW_KEY` / `WORKFLOW_KEYS`. Condition types use `WORKFLOW_ESCALATION_CONDITION_TYPE`. Deprecation uses `WORKFLOW_REGISTRY_ACTIVE` (`active: false`), not renames.

## 3. Global default vs org-specific override

| `organization_id` | Semantics |
|-------------------|-----------|
| `NULL` | Platform **global default** (seeded in migration 0083). |
| Non-null UUID | **Org-specific override** — takes precedence for that organization. |

**Resolution (`getWorkflowAuthority`):**

1. Active org-specific row for `(organization_id, workflow_key)`  
2. Else active global row where `organization_id IS NULL`  
3. Else **throw** `WorkflowDecisionAuthorityNotFoundError` (never fail silently)

**Escalation rules (`getWorkflowEscalationRules`):**

1. Active org-specific rules for `workflow_key` (if any exist, return only these)  
2. Else active global rules where `organization_id IS NULL`  
3. Else return `[]`

## 4. Conditional escalation readiness

`workflow_authority_escalation_rules` stores structured predicates (`condition_type` + `condition_expression` JSONB) that can raise effective authority when context matches (e.g. lab safety signal → `system_enforced`).

**GOV-1 does not evaluate conditions** — rules are schema + registry only. A future evaluator (v2) will compute `effective_authority_level` from `base_authority_level` and matching rules.

## 5. Static classification v1 / dynamic escalation v2

| Version | Delivered in GOV-1 | Deferred |
|---------|-------------------|----------|
| **v1 — Static classification** | Seeded `workflow_decision_authorities`, TypeScript loaders, RLS, documentation | — |
| **v2 — Dynamic escalation** | Escalation rule **schema**, seeds, `getWorkflowEscalationRules` | Condition evaluator, real-time escalation triggers, runtime enforcement hooks |

## 6. Immutability conventions

| Field | Rule |
|-------|------|
| `workflow_key` | **Immutable** once referenced by runtime projections, replay artifacts, or governance signals. Never rename. |
| Deprecated workflow | Set `active = false` only. |
| `rule_key` | **Immutable** on escalation rules after insert. |
| `condition_expression` | **Immutable** historical governance metadata once referenced by traces or replay. Append a new rule row instead of editing. |
| `condition_type` | **Immutable** on UPDATE (DB trigger). |

Enforced in PostgreSQL via `0084_phase16_gov1_workflow_key_immutability.sql` and in TypeScript via `immutability.ts`.

## 7. OBS-2 / trace contract (future)

When AI observability (OBS-2) ships, every governed decision MUST record:

- `workflow_key` — `WorkflowKey` enum from `WORKFLOW_KEY` (never a display name)  
- `base_authority_level` — `WorkflowAuthorityLevel` enum  
- `effective_authority_level` — same enum after escalation (never free-text labels such as `authorityName`)

Use `buildGovernedWorkflowTraceRefs()` from `observability-contract.ts`. Even when base and effective are identical, both must be present.

**Forbidden in trace payloads:** `authorityName`, `authorityLabel`, `authorityDisplayName`, or any ad-hoc authority string not in `WORKFLOW_AUTHORITY_LEVELS`.

## 8. Out of scope in v1

- Dynamic condition evaluation (v2)  
- Real-time escalation triggering (v2)  
- AI integration with authority layer (Phase 22)  
- Org-level authority customization UI (future)  
- UI / dashboards  
- Runtime behavior changes  
- AI API calls  

## Schema summary

### `workflow_decision_authorities`

Registry of per-workflow authority posture: `workflow_key`, `category`, `base_authority_level`, AI/human/system flags, `regulated`, `phi_sensitive`, `audit_required`, `conditional_escalation_supported`, `notes`, `active`.

### `workflow_authority_escalation_rules`

Conditional escalation definitions: `workflow_key`, `rule_key`, `condition_type`, `condition_expression`, `from_authority_level`, `to_authority_level`, confirmation/blocking flags.

**Non-PHI policy:** `notes` and `condition_expression` must not contain subject identifiers or clinical content. DB check constraints block obvious PHI patterns in `notes`.

## Seeded workflows (global — GOV1_CORE_WORKFLOW_KEYS)

| `workflow_key` | `base_authority_level` | Escalation `rule_key` |
|----------------|------------------------|------------------------|
| `eligibility` | `human_required` | `unresolved_required_criterion` |
| `randomization` | `system_enforced` | `missing_prerequisite_evidence` |
| `source_signing` | `system_enforced` | `missing_required_signature` |
| `visit_locking` | `human_required` | — |
| `ae_workflow` | `human_required` | — |
| `protocol_deviation` | `human_required` | — |
| `financial_reconciliation` | `assistive` | `audit_triggered_dispute` |
| `query_management` | `assistive` | — |
| `scheduling` | `assistive` | — |
| `lab_safety_escalation` | `human_required` | `severe_thrombocytopenia_or_hit_signal` |

### Seeded escalation rules (0083 — condition evaluator deferred to v2)

| `workflow_key` | `rule_key` | `condition_type` | `from` → `to` |
|----------------|------------|------------------|---------------|
| `lab_safety_escalation` | `severe_thrombocytopenia_or_hit_signal` | `lab_result_rule` | `human_required` → `system_enforced` |
| `eligibility` | `unresolved_required_criterion` | `eligibility_state` | `human_required` → `system_enforced` |
| `source_signing` | `missing_required_signature` | `signature_state` | `system_enforced` → `system_enforced` |
| `randomization` | `missing_prerequisite_evidence` | `protocol_runtime_rule` | `system_enforced` → `system_enforced` |
| `financial_reconciliation` | `audit_triggered_dispute` | `financial_audit_state` | `assistive` → `human_required` |
| `source_integrity_snapshot` | `system_enforced` | `hash_mismatch_detected` |
| `source_integrity_violation` | `system_enforced` | — |
| `workflow_abandonment_review` | `human_required` | `stale_workflow_unresolved_past_escalation_threshold` |
| `role_conflict_resolution` | `human_required` | `single_staff_site_exemption` |

Migration `0087_phase16a26_gov1_extension.sql` seeds audit-integrity pilot workflows and escalation rules (Phase 16A-2.6).

## RLS

| Operation | Scope |
|-----------|--------|
| **SELECT** | Global rows (`organization_id IS NULL`) + org member rows |
| **INSERT/UPDATE/DELETE** | Org-specific rows only; requires `user_can_manage_ai_governance(organization_id)` |

Global seeds are migration-managed; authenticated users cannot mutate global rows via RLS.

## Usage

```typescript
import { createServerClient } from '@/lib/supabase/server'
import {
  WORKFLOW_KEY,
  WORKFLOW_AUTHORITY_LEVEL,
  getWorkflowAuthority,
  getWorkflowEscalationRules,
  buildGovernedWorkflowTraceRefs,
} from '@/lib/governance/workflow-authority'

const supabase = await createServerClient()
const authority = await getWorkflowAuthority({
  supabase,
  organizationId: orgId,
  workflowKey: WORKFLOW_KEY.ELIGIBILITY,
})
const rules = await getWorkflowEscalationRules({
  supabase,
  organizationId: orgId,
  workflowKey: WORKFLOW_KEY.ELIGIBILITY,
})
const traceRefs = buildGovernedWorkflowTraceRefs({
  workflowKey: authority.workflowKey,
  baseAuthorityLevel: authority.baseAuthorityLevel,
  effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
})
```

## Validation

```bash
npm run gov1:smoke
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Apply migrations `0083` and `0084` on each environment before calling loaders against the database.
