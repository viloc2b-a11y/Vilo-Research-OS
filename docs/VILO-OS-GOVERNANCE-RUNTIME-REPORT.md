# Vilo OS Governance Runtime Report

Date: 2026-06-03

## What was added

- Protocol PI acceptance now runs through the universal operational Signature Engine.
- Governance requests can target `protocol_version` artifacts and persist acceptance state back onto `protocol_runtime_versions`.
- Delegation log and training acknowledgements continue to reuse the existing operational signature queue and audit trail.
- Amendment-aware retraining can be generated from the active protocol version and active delegation log.
- The Study Workspace now exposes a dedicated `Governance` section.
- The governance summary now counts pending governance signature requests for the coordinator queue.

## What was reused

- Universal operational signature engine
- Existing delegation runtime
- Existing training log runtime
- Existing protocol runtime study/version records
- Existing Study Workspace shell, nav, and coordinator queue patterns

## Tests run

- `npx tsx scripts/governance-runtime-smoke.ts`
- `npx tsc --noEmit`
- `npm run coordinator-ops:smoke`
- `npm run db:validate-phase7-vpi`
- `npx tsx scripts/operational-signature-k5-smoke.ts`
- `npx eslint --no-warn-ignored scripts/governance-runtime-smoke.ts lib/studies/governance-runtime-actions.ts lib/studies/training-log-actions.ts lib/study-workspace/load-governance-summary.ts lib/study-workspace/study-workspace-types.ts components/study-workspace/study-governance-panel.tsx components/study-workspace/study-workspace-shell.tsx components/study-workspace/study-workspace-nav.tsx app/(ops)/studies/[studyId]/workspace/page.tsx lib/operational-signatures/artifact-loader.ts lib/operational-signatures/sign-artifact.ts app/api/operational-signatures/[id]/sign/route.ts lib/protocol-intake-runtime/protocol-intake-types.ts`

## What passed

- Governance smoke passed.
- TypeScript compile passed.
- Coordinator operations smoke passed.
- Phase 7 VPI validation passed.
- Operational signature K5 smoke passed.
- ESLint passed on the touched governance and signature files.

## What remains partial

- Governance Runtime v1 covers protocol acceptance, delegation, and training acknowledgements.
- Closeout certification workflows remain the next logical extension:
  - final PI sign-off
  - source completion certification
  - regulatory closeout certification
- The system still uses the universal signature engine as the single signing truth; there is no parallel governance signature layer.

## Proof no parallel layer was introduced

- Governance signatures are persisted through `operational_signature_requests` and `operational_signatures`.
- Protocol acceptance state is stored on the existing `protocol_runtime_versions` row.
- Delegation and training continue to use existing runtime tables and append-only audits.
- The coordinator surface consumes the existing queue and study workspace sections rather than a new governance platform.
