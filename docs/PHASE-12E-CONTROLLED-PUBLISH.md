# Phase 12E — Controlled Publish Preparation

**Status:** 12E-A publish candidate + 12E-B final approval gate. No runtime activation.

**Parents:** [`PHASE-12D-INTAKE-REVIEW.md`](./PHASE-12D-INTAKE-REVIEW.md)

## Flow

```text
Source Builder → Intake Review → Approved Draft → Publish Prep → Publish Candidate → Candidate Review → Approval
```

| Step | Route | Artifact |
|------|-------|----------|
| 12D review | `/source-builder/intake/review/[draftKey]` | `approved_intake_draft.json`, `review_audit.json` |
| 12E-A preflight | `/source-builder/intake/publish-prep/[draftKey]` | `publish_candidate.json` (on explicit create) |
| 12E-B review | `/source-builder/intake/publish-prep/[draftKey]/review` | `publish_candidate_approval.json` (on explicit approve) |

Approved draft path: `data/intake-review-workspaces/{draftKey}/`  
Publish candidate path: `data/source-publish-candidates/{draftKey}/`

## Status model

| Status | Meaning |
|--------|---------|
| `not_ready` | No `approved_intake_draft.json` |
| `blocked` | Approved draft exists but preflight has blockers |
| `ready_for_candidate` | Preflight passed; candidate not yet created |
| `candidate_pending_review` | Candidate on file; final checks pass; not yet approved |
| `candidate_blocked` | Candidate on file; final review blockers |
| `candidate_approved` | `publish_candidate_approval.json` on file |

## Preflight (all blockers must pass)

- Approved draft exists
- `review_audit.json` exists
- All operational sections in `approval_summary.sections_approved`
- Metadata: protocol id/number + title
- ≥1 approved visit with `visit_code`
- ≥1 approved procedure with `procedure_code`
- Source composition rows linked to approved procedures
- `rejected_items` array retained
- Safety: `auto_publish`, `auto_bind`, `runtime_mutation` all `false`

## Publish candidate

Created only via **Create publish candidate** when preflight passes.

- `publish_ready: false` (always in 12E)
- `runtime_activation: false`
- `PUBLISH_PREP_SAFETY` mirrors 12D constraints
- Audit: `publish_candidate_audit.json` appends `publish_candidate_created` event

## Module

- `@/lib/protocol-intake-publish-prep` — load, preflight, build, write (filesystem only)
- Does **not** import or modify `@/lib/protocol-intake` / `@/lib/protocol-intake-review` behavior

## Out of scope (12E)

- Auto-publish, auto-bind, silent runtime mutation
- AI decisions
- Final `publish_source_package` activation
- Billing, analytics, notifications
- Changes to 12C/12D

## 12E-B — Final candidate approval

Human gate after publish candidate exists. Does **not** create a live source package or call `publish_source_package`.

### Final blocking checks

- `publish_candidate.json` exists
- `publish_ready` / `runtime_activation` false on candidate
- `auto_publish` / `auto_bind` / `runtime_mutation` false
- Approved draft and review audit files exist on disk

### Approval artifact

`publish_candidate_approval.json` — requires **approval reason**. Audit appends `publish_candidate_approved`.

## Smoke

```bash
npx tsx scripts/phase12e-publish-prep-smoke.ts
npx tsx scripts/phase12eb-publish-candidate-review-smoke.ts
```
