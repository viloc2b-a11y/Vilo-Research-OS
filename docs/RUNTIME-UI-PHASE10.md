# Phase 10 — Runtime UI Integration

Surfaces runtime intelligence inside the existing coordinator visit and subject workspaces. Not a dashboard, sponsor portal, or generic task manager.

## Principles

- Coordinator-first: actionable next actions in context
- Derived from projections (Phases 2–9)
- No decorative metrics — leakage only when actionable
- Automation apply requires explicit coordinator action
- UX guardrails cap list sizes (overload compact mode)

## Visit workspace (`/visits/[visitId]`)

| Surface | Location |
|---------|----------|
| Runtime status badge | Visit header |
| **Next action strip** + compact blockers | Below header (`variant="compact"`) |
| **Visit Runtime Action Panel** (full) | Procedures tab |
| Work queue + automation review | Workflow tab (`variant="workflow"`) |
| **Why blocked?** drawer | Collapsible in full/workflow/compact |

## Subject workspace

| Surface | Location |
|---------|----------|
| **Subject Runtime Summary Panel** | Subject chart → General tab |
| Same panel | `/subjects/[id]/workspace` |

## Components (`components/runtime-ui/`)

- `CoordinatorNextActionStrip`
- `SafetyGovernanceBlockerPanel`
- `FinancialLeakageWarningPanel`
- `RuntimeWhyBlockedDrawer`
- `RuntimeWorkQueuePanel`
- `AutomationProposalReviewPanel` (client — apply)
- `VisitRuntimeActionPanel`
- `SubjectRuntimeSummaryPanel`
- `RuntimeUxGuardrails`

## Data layer (`lib/runtime-ui/`)

- `loadVisitRuntimeUiModel` — refreshes readiness + loads orchestration/automation projections
- `loadSubjectRuntimeUiModel`
- `mapVisitRuntimeUiModel` / `mapSubjectRuntimeUiModel`
- Server actions: `applyVisitAutomationProposalAction`, reverse, override

## Validation

```bash
npm run runtime-ui:smoke
```

## Non-goals

- Sponsor / analytics dashboards
- AI copilot
- Separate finance or QA modules
- Rewriting visit runtime execution
