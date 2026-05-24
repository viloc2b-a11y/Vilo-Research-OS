# Phase 9 — Adaptive Runtime Automation Engine

Runtime-adaptive orchestration automation for Vilo OS. Assists coordinator execution; does **not** replace coordinator authority. No AI copilot UI, dashboards, sponsor portals, or blind automation.

## Principles

| Rule | Implementation |
|------|----------------|
| Automation derives from runtime | Rules evaluate orchestration + readiness + burden |
| `operational_events` canonical | PROPOSED / APPLIED / REVERSED / OVERRIDDEN events on spine |
| Coordinator supervisory | Plans are proposed; apply requires explicit `applyVisitRuntimeAutomationPlan` |
| Projections derived | `visit_runtime_automation_projections`, `subject_runtime_automation_projections` |
| No clinical auto-mutation | No procedure complete, no signature bypass, no protocol rewrite |

## Two phases

### 1. Compute (projection refresh)

Builds `RuntimeAutomationPlan`:

- triggered rules
- proposed actions (throttled under overload)
- adapted urgency
- governance safeguards

**No side effects** on clinical tables.

### 2. Apply (explicit coordinator action)

`applyVisitRuntimeAutomationPlan({ automation, actorUserId })`:

- May materialize `subject_workflow_actions` (follow-up / correction)
- Records `runtime_automation_executions`
- Emits `RUNTIME_AUTOMATION_APPLIED` + workflow spine events

`reverseRuntimeAutomationExecution` / `overrideRuntimeAutomationExecution` emit reversible spine events.

## Automation triggers (v1)

| Trigger | Typical source |
|---------|----------------|
| `unresolved_safety` | Safety blockers / AE count |
| `overdue_workflow` | Coordinator burden metrics |
| `visit_window_pressure` | Past scheduled date / SLA |
| `governance_escalation` | Governance blockers / escalation queue |
| `financial_leakage` | Financial runtime escalation |
| `replay_recurring_friction` | Replay summary / friction |
| `coordinator_overload` | Burden score ≥ 65 |
| `repeated_reschedules` | ≥ 2 reschedules |

## Automation actions (v1)

| Action | Effect on apply |
|--------|-----------------|
| `materialize_workflow` | Inserts coordinator workflow row (deduped) |
| `route_pi_review` | PI-assigned follow-up workflow |
| `route_coordinator_follow_up` | CRC follow-up workflow |
| `route_operational_escalation` | Escalation workflow + spine |
| `create_review_requirement` | Review workflow |
| `escalate_urgency` | Urgency adaptation only (projection) |
| `strengthen_blocker_hint` | Derived hint only (no clinical write) |
| `create_orchestration_action` | Links to orchestration next-action id in payload |

## Governance safeguards

- No silent clinical mutation (`blocksApply` on violation)
- Spine events required on apply / reverse / override
- Workflow flood warning
- Overload throttling (`OVERLOAD_MAX_ACTIONS = 5`)

## Integration

Visit readiness pipeline:

```
… → coordinator orchestration → runtime automation
```

Coordinator bridge: `deriveAutomationPlanFromOrchestration` (pure function).

## Module layout

```
lib/runtime-automation/
  rules/           registry v1
  evaluate/        triggers, derive-actions
  adapt/           urgency, overload
  plan/            build-plan
  automate/        escalation, safety, financial, workflow-materialize
  safeguards/      governance
  emit/            automation-events
  execute/         apply, reverse, override
  integration/     projection + coordinator bridges
```

## Migration

`supabase/migrations/0081_phase9_runtime_automation.sql`

## Validation

```bash
npm run automation:smoke
```

## Explicit non-goals

- AI chatbot UX
- Auto-complete clinical forms
- Signature bypass
- Automatic protocol truth mutation
- Runtime execution rewrite
