# Phase 16A-1 — GOV-0 Lightweight AI Governance Foundation

**Phase:** 16A-1  
**Status:** Foundation only (no AI execution, no UI)

## Purpose

Establish a minimal, org-scoped **AI system inventory** and **incident log** so Vilo OS can register AI/ML touchpoints, risk posture, and human-in-the-loop requirements before any production AI features ship during coordinator pilot stabilization.

This phase is **governance infrastructure only**. It does not change clinical runtime behavior, projections, automation apply paths, or capture flows.

## Non-goals (explicit)

- No UI or dashboards
- No AI API calls, agents, or copilots
- No telemetry hooks into runtime spine
- No workflow or automation integration
- No production seed data
- No PHI storage in `metadata` (enforced in TypeScript helpers)

## Schema

### `ai_system_inventory`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `organization_id` | FK → `organizations` |
| `system_name` | Display / registry name |
| `system_type` | e.g. `llm`, `rules_engine`, `embedding` |
| `vendor` | Optional |
| `model_name` | Optional |
| `owner_role` | Accountable site role |
| `use_case` | Plain-language scope |
| `risk_tier` | `low` \| `medium` \| `high` \| `critical` |
| `human_in_loop_required` | Default `true` |
| `phi_allowed` | Default `false` |
| `status` | `draft` \| `approved` \| `active` \| `paused` \| `retired` |
| `metadata` | JSONB, **non-PHI only** |
| `created_at` / `updated_at` | Audit |

**Indexes:** `organization_id`, `(organization_id, risk_tier)`, `(organization_id, status)`, `(organization_id, created_at desc)`.

### `ai_incidents`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `organization_id` | FK → `organizations` |
| `ai_system_id` | Optional FK → inventory |
| `severity` | `low` \| `medium` \| `high` \| `critical` |
| `incident_type` | Free-text category (e.g. `policy_violation`, `drift`) |
| `description` | Required narrative |
| `affected_entity_type` / `affected_entity_id` | Optional clinical entity pointer |
| `trace_id` | Optional correlation UUID |
| `status` | `open` \| `investigating` \| `mitigated` \| `closed` |
| `corrective_action` | Optional |
| `created_by` | Optional FK → `auth.users` |
| `created_at` / `closed_at` | Lifecycle |

**Indexes:** `organization_id`, `ai_system_id`, `(organization_id, status)`, `(organization_id, created_at desc)`.

**Migration:** `supabase/migrations/0082_phase16a1_ai_governance_foundation.sql`

## Risk tiers

| Tier | Human-in-the-loop (inventory rule) | PHI default |
|------|-----------------------------------|-------------|
| `low` | Recommended default `true`; not forced by helper | `false` |
| `medium` | Same | `false` |
| `high` | **Required** `human_in_loop_required = true` | `false` |
| `critical` | **Required** `human_in_loop_required = true`; `phi_allowed` should remain `false` | `false` |

TypeScript: `lib/ai-governance/risk-tier.ts` — `validateAiSystemInventoryInput`, `riskTierRequiresHumanInLoop`.

## RLS summary

| Operation | Who |
|-----------|-----|
| **SELECT** | Active org members (`user_organization_ids()`) |
| **INSERT / UPDATE / DELETE** | Org owner/admin **or** `study_admin` on any study in the org (`user_can_manage_ai_governance`) |
| **anon / public** | Revoked on tables |

Helper: `public.user_can_manage_ai_governance(organization_id)` (migration-local, SECURITY DEFINER).

## TypeScript helpers

| Module | Role |
|--------|------|
| `lib/ai-governance/types.ts` | Record + input types |
| `lib/ai-governance/risk-tier.ts` | Constants, validation, PHI metadata guard |
| `lib/ai-governance/index.ts` | Public exports |

## Incident runbook (basics)

1. **Detect** — Manual report or future observability (out of scope for 16A-1).
2. **Open** — Insert `ai_incidents` with `status = open`, link `ai_system_id` when known.
3. **Investigate** — Set `investigating`; record `trace_id` if correlating to runtime/replay later.
4. **Mitigate** — Pause inventory row (`status = paused`) if needed; document `corrective_action`.
5. **Close** — `status = closed`, set `closed_at`.

Do not store PHI in `description` when a subject identifier would suffice — use `affected_entity_type` + `affected_entity_id` only when operationally necessary and access-controlled elsewhere.

## Future relationship to AI observability

Later phases may:

- Emit read-only governance signals from runtime (without changing clinical mutations)
- Correlate `trace_id` to `operational_events` / replay segments
- Require an active, approved `ai_system_inventory` row before any AI feature flag enables

16A-1 intentionally leaves hooks empty so pilot stabilization is not coupled to AI traffic.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/phase16a1-ai-governance-smoke.ts
git diff --check
```

## Dev/test examples (documentation only)

Example inventory row (not seeded in production):

```json
{
  "system_name": "Coordinator routing labels (disabled)",
  "system_type": "rules_engine",
  "risk_tier": "low",
  "human_in_loop_required": true,
  "phi_allowed": false,
  "status": "draft",
  "metadata": { "environment": "staging", "gov_phase": "16a1" }
}
```
