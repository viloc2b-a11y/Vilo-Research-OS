# Code Context — Budget Evidence / Activity Code Library thread

## Files Retrieved
1. `lib/study-workspace/load-budget-evidence-summary.ts` (1663 lines) — core loader + `deriveBudgetNegotiationIntelligence` (lines ~470-770 hold the new activity-code enrichment block ~line 575+); `loadStudyBudgetEvidenceSummary` at line 1101.
2. `lib/cliniq-core/activity-code-library.ts` (full, new) — `ActivityCodeEntry` type + `loadActivityCodeCatalog`.
3. `lib/study-workspace/load-budget-evidence-summary.test.ts` (full, new) — 9 vitest cases for the enrichment. **GREEN.**
4. `supabase/migrations/0222_activity_code_library.sql` (full, new) — table + RLS + 40-row global seed.
5. `components/study-workspace/study-command-center-view.tsx` (diff) — Revenue Intelligence card + revenue-protection chips.
6. `components/study-workspace/budget-negotiation-ledger-panel.tsx` (diff) — pass-through risk signal + copy tweaks.
7. `app/(ops)/studies/[studyId]/workspace/page.tsx` (lines 103-107) — call site of the loader.
8. `scripts/seed-demo-financial.ts` (647 ln, new), `scripts/protocol-to-source-e2e-smoke.ts` (574 ln, new).

## 1. What the thread is doing
The thread enriches the existing budget-negotiation "intelligence" engine with a reusable **activity-code library** (FMV reference catalog) so sponsor line-item amounts can be compared per-activity against fair-market-value bands, not just family-level blended benchmarks. Migration 0222 introduces a dual-scope (`global` + per-org override) `activity_code_library` table seeded with 40 codes across 5 categories. `deriveBudgetNegotiationIntelligence` now accepts an optional `activityCodeCatalog`, producing `fmvGap.perActivityDetails` ("Coordinator Time (Operational) — $45/per_hour offered, expected $65–85/per_hour. Gap: 47%.") and a named `unpricedItems` list, escalating `fmvGap.level` from gap %. In parallel the command-center card is rebranded "Budget/CTA Evidence" → "Revenue Intelligence" with Expected/Earned/Revenue-at-Risk chips wired to `computeRevenueProtection`. The seed + e2e smoke scripts make the whole Protocol→Source→Financial pipeline render real dollar values for demo/validation.

## 2. Existing patterns & conventions
- **Loaders** live in `lib/study-workspace/*` and `lib/cliniq-core/*`. Signature pattern: take `supabase` client + `organizationId`/`studyId`, return a typed model (here `StudyBudgetEvidenceSummary` / `ActivityCodeEntry[]`).
- **Error handling**: loader uses `safeExactCount`/try-catch that PUSH to a string `unavailable[]` array and return `null`/`[]` (never throw, graceful degradation). `activity-code-library.ts` instead uses `try/catch` returning `[]` and logs via `console.error` — **inconsistent** with the project's no-`console.log`/logger rule and with the `unavailable[]` pattern used in the same feature.
- **Data flow**: supabase → loader (`loadStudyBudgetEvidenceSummary`) → server component `page.tsx` → `study-command-center-view.tsx` → `BudgetNegotiationLedgerPanel`. Pure derivation functions (`deriveBudgetNegotiationIntelligence`, `deriveBudgetNegotiationState`) are exported separately and unit-tested in isolation.
- **Tests**: vitest (`npm test` = `vitest run`), Testing-Library style fixtures built via `makeLineItem`/`makeLedgerEntry`/`makeSummary` factories; assertions target the pure derivation output. No supabase mock — they test the pure function directly. Tests are excluded from GGA review per `.gga`.
- **Migrations**: numbered `NNNN_name.sql`; 0222 deliberately mirrors `procedure_library` (0110) — partial unique indexes for dual-scope, `user_has_active_organization_membership` RLS helper, `touch_updated_at` trigger, idempotent `DO $$ ... IF EXISTS RETURN` seed guard.

## 3. Constraints
- **Financial truth boundary** (Coverage→Evidence→Truth→Revenue): negotiation line items are NOT pricing truth until accepted/effective. `deriveNegotiationLineItemStatus` sets `financialTruth:true` only for `term_accepted` or `term_adjusted` with `approved_for_pricing|pricing_effective|effective_financial_term === true`. Activity-code enrichment is advisory only and must not promote any item to financial truth. The export markdown explicitly states "Financial Runtime remains the source of truth." New code must respect this — enrichment feeds FMV *signals*, not invoiceable amounts.
- **Activity codes are an INTERNAL table, not an external standard (no CPT)**. `code` is a free string (e.g. `COORD_HOUR`, `IRB_ANNUAL`), categories constrained to `clinical|operational|regulatory|financial|conditional`, units to `per_visit|per_hour|per_patient|flat|per_event`. Line items reference them via optional `activity_code` string on `StudyBudgetNegotiationLineItem`.
- **0222 schema**: `activity_code_library(id, organization_id NULL→org-override, code, name, category, sub_category, typical_unit, fmv_low/fmv_high numeric(10,2) NULL, notes, timestamps)`. CHECK constraints on category, unit, and `fmv_low <= fmv_high`. RLS: global rows readable by all authenticated; org rows by members; writes org-only (global immutable from client). **Seeded 40 codes all have fmv_low/fmv_high = NULL.**
- TS `strict:true`; enrichment block guards on null fmv and null amount before producing detail (matches test case 7).

## 4. Integration points
- `loadStudyBudgetEvidenceSummary` callers: `app/(ops)/studies/[studyId]/workspace/page.tsx:103`, `app/api/study-workspace/[studyId]/budget-negotiation-export/route.ts:47`, `scripts/budget-negotiation-e2e-smoke.ts:328`.
- `study-command-center-view.tsx` now imports `computeRevenueProtection` (`lib/financial-runtime/revenue-protection`) and renders Expected/Earned/Revenue-at-Risk chips in the renamed "Revenue Intelligence" card; passes `summary` to `BudgetNegotiationLedgerPanel`.
- `budget-negotiation-ledger-panel.tsx` consumes `summary.budgetIntelligence.*` signals (now adds optional `passThroughRisk`). It does NOT yet render `fmvGap.perActivityDetails` or `unpricedItems` — UI surfacing of the new enrichment fields is absent.
- `seed-demo-financial.ts` seeds the PILOT fixture study (uses `SUPABASE_SERVICE_ROLE_KEY`, node-only script) with negotiation events/invoices/payments so revenue chips show dollars; `protocol-to-source-e2e-smoke.ts` validates the Protocol→Runtime→Source chain (dry by default, `--live` against seeded data). Both are standalone CLI validation scripts, not imported by app code.

## 5. Test state
- `npx vitest run lib/study-workspace/load-budget-evidence-summary.test.ts` → **9 passed (GREEN)**. Project test command: `npm test` (`vitest run`).

## 6. Risks / half-done edges
- **DEAD WIRING (biggest gap):** `loadStudyBudgetEvidenceSummary` calls `deriveBudgetNegotiationIntelligence({ summary })` WITHOUT `activityCodeCatalog`. `loadActivityCodeCatalog` is exported but **never called anywhere** (grep confirms only self-references). So the entire enrichment path is exercised only by the unit test — production never loads the catalog. The loader needs to call `loadActivityCodeCatalog(supabase, orgId)` and thread it through.
- **Seed has no FMV values:** all 40 seeded codes have `fmv_low/fmv_high = NULL`. The enrichment only emits `perActivityDetails`/gap% when fmv bounds are non-null, so even if wired, the global seed produces zero detail until orgs add FMV overrides or the seed is populated.
- **`console.error` in `activity-code-library.ts`** violates the project's no-console / logger convention and diverges from the `unavailable[]` degradation pattern used by its sibling loader.
- **UI not surfacing new fields:** `perActivityDetails` and `unpricedItems` are computed but no component renders them; the export markdown also doesn't include them.
- `study_budget_negotiation_events` line items carry `activity_code` but there's no validation that the code exists in the library (no FK; free string) — orphan codes silently skip enrichment.
- Seed/smoke scripts use `service_role` key — confirm they are node-only (they are CLI/`tsx`), covered by `safety-net:service-role-audit`.

## Start Here
Open `lib/study-workspace/load-budget-evidence-summary.ts` at `loadStudyBudgetEvidenceSummary` (line 1101) and the `deriveBudgetNegotiationIntelligence` call near the end — that is where `activityCodeCatalog` must be loaded and passed to make the new, tested capability actually live.

## Remaining clarification questions (product-owner only)
1. **Wiring scope for this slice:** is the goal of this commit to make activity-code enrichment LIVE in production (loader loads catalog + UI renders `perActivityDetails`/`unpricedItems`), or only to land the table/library/derivation primitives with UI deferred?
2. **FMV source of truth:** seeded codes have NULL FMV bands — who populates fmv_low/high (migration seed values, per-org configuration, or an external benchmark import), and is shipping all-NULL acceptable for the demo?
3. **Org vs global authority:** when an org override and a global code share a `code`, the loader lets org win — is that the intended business rule for FMV, or should global FMV bands be authoritative and only names/notes overridable?
4. **Activity-code ↔ line-item linkage:** should `activity_code` on negotiation line items be validated/constrained against the library (FK or app-level), or remain a free advisory string?
5. **Definition of done:** does this slice require the export markdown + ledger panel to surface the new per-activity FMV details and unpriced list, or is the API/derivation layer sufficient?
6. **Demo scripts in scope:** are `seed-demo-financial.ts` and `protocol-to-source-e2e-smoke.ts` meant to ship as part of this PR (and be added to package.json `*:smoke`/`db:validate-*` scripts), or are they local validation aids only?

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Recon-only: no files edited. Produced compressed handoff at context.md covering thread intent, patterns, constraints, integration points, test state, risks, and 6 blocking questions."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Evidence includes exact file/line refs, the GREEN vitest run command+result, the dead-wiring discovery (loadActivityCodeCatalog never called; loader omits activityCodeCatalog), and NULL-FMV seed gap."
    }
  ],
  "changedFiles": ["context.md (new scout artifact only)"],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {"command": "git status --short", "result": "passed", "summary": "Confirmed 3 modified + 5 new untracked focus files on branch main"},
    {"command": "npx vitest run lib/study-workspace/load-budget-evidence-summary.test.ts", "result": "passed", "summary": "9/9 tests GREEN"}
  ],
  "validationOutput": ["vitest: Test Files 1 passed (1), Tests 9 passed (9)"],
  "residualRisks": [
    "Activity-code enrichment is dead in production: loadStudyBudgetEvidenceSummary never passes activityCodeCatalog and loadActivityCodeCatalog is never called.",
    "All 40 seeded activity codes have NULL FMV bands, so enrichment yields no detail even if wired.",
    "console.error in activity-code-library.ts diverges from project logger/unavailable[] convention.",
    "New perActivityDetails/unpricedItems fields are computed but not surfaced in any UI or export."
  ],
  "noStagedFiles": true,
  "notes": "Recon only, no source edits. Only context.md was written as the requested handoff artifact. Test file is GREEN, not RED."
}
```
