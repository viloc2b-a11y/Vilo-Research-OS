# Deep Sanitization Audit — Second Pass

**Date:** 2026-06-22  
**Based on:** First-pass cleanup (2 smoke scripts deleted) + full repository deep scan  
**Method:** `ripgrep` across `lib/`, `app/`, `components/`, `scripts/`, `docs/`, `fixtures/`, `validation-corpus/`, `.tmp/`, `artifacts/`

---

## 1. Executive Summary

This pass identifies **6 categories** of protocol-derived or validation-related content beyond what was found in the first audit.

| Category | Count | Classification |
|----------|-------|---------------|
| Staging pilot fixture defaults | 1 file | REVIEW_REQUIRED — contains real UUIDs + study slug |
| Hardcoded smoke protocol names in scripts | ~10 scripts | SAFE_DELETE or REPLACE_GENERIC |
| Historical protocol docs (stale) | 2 docs | SAFE_DELETE — reference non-existent fixture directories |
| Validation output artifacts | ~3 files/dirs | SAFE_DELETE — stale generated outputs |
| `.tmp/budgets_extract/` | ~50+ files | REVIEW_REQUIRED — contains real uploaded budget docs |
| `validation-corpus/source-drafts/` | 2 files | SAFE_DELETE — stale generated artifacts (test_study_001) |
| Staging/validation docs | ~10 docs | KEEP_DOCUMENTATION — explain historical validation |

---

## 2. Category A — Staging Pilot Fixture Defaults

**File:** `lib/runtime-validation/pilot-fixture-defaults.ts`

```ts
export const PILOT_FIXTURE_DEFAULTS = {
  studyId: '6bae715a-8536-4000-8d24-22b6a3dbb8c9',
  organizationId: 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e',
  studySubjectId: '4384b789-4e16-4512-b3f3-50642b3b9735',
  visitId: '6690da63-4bf1-4681-815a-3e39b7b014bc',
  coordinatorActorUserId: 'd7e43ee5-5c08-489b-b293-8ef288e7fdb7',
  studySlug: 'phase2-validation-study',
  subjectIdentifier: 'PHASE9A-PILOT-001',
  ...
}
```

**Used by:** `scripts/seed-demo-financial.ts`, `scripts/budget-negotiation-e2e-smoke.ts`, `verify-pilot-source-binding.ts`, `verify-pilot-procedure-linkage.ts`

**Classification:** REVIEW_REQUIRED  
**Risk:** Contains real UUIDs and protocol-derived study identifiers (`phase2-validation-study`, `PHASE9A-PILOT-001`). However, these are staging defaults — they reference a known validation study used by smoke tests. Replacing them would break all smoke/seed scripts that depend on this file.

**Recommendation:** Keep as-is for now. These are staging/test infrastructure values, not production secrets. The study slug is intentionally descriptive. If desired, replace with env-var-only defaults and remove hardcoded UUIDs.

---

## 3. Category B — Scripts with Hardcoded Protocol Names

### B1. Stale smoke scripts

| File | Hardcoded reference | Classification |
|------|-------------------|----------------|
| `scripts/budget-negotiation-e2e-smoke.ts` | `studyName: 'Budget Negotiation Smoke Study'`, `studySubjectId: 'subject-smoke'` | SAFE_DELETE — one-time E2E smoke |
| `scripts/document-center-generalization-batch.ts` | `studyPrefix: 'GEN_A001'`, `'GEN_A002'`, `'GEN_VAC'`, `'GEN_ONC'` | REVIEW_REQUIRED — batch generalization script, used infrequently |
| `scripts/vip-adapter-smoke.ts` | `protocol_title: 'VIP Adapter Smoke Protocol'` | SAFE_DELETE — one-time smoke |
| `scripts/seed-protocol-runtime-smoke.ts` | Creates study with error message `Failed to create smoke study` | REVIEW_REQUIRED — seed script for protocol runtime, may be used in CI |
| `scripts/consent_runtime_completion_smoke.ts` | `'Smoke ICF v1'`, `'Smoke ICF v2'` | REVIEW_REQUIRED — consent smoke, may be used in CI |
| `scripts/consent_runtime_build_validation_audit.py` | Python audit script | KEEP_OPERATIONAL — validation audit tooling |

### B2. Previously deleted (confirmed)

| File | Status |
|------|--------|
| `scripts/reader-closure-live.ts` | ✅ Deleted in first pass |
| `scripts/document-center-e2e-live.ts` | ✅ Deleted in first pass |

---

## 4. Category C — Historical Protocol Docs (Stale)

| File | References | Classification |
|------|------------|----------------|
| `docs/PARA_OA_012-OPERATIONAL-11F-A.md` | References `fixtures/para-oa-012/runtime-manifest.v1.json` — **directory does NOT exist** | SAFE_DELETE — stale doc referencing non-existent fixtures |
| `docs/MV40618-OPERATIONAL-11F-B.md` | References `fixtures/mv40618/runtime-manifest.v1.json` — **directory does NOT exist** | SAFE_DELETE — stale doc referencing non-existent fixtures |

Both docs reference fixture directories that no longer exist in the repository. They are historical artifacts from early validation passes.

---

## 5. Category D — Validation Output Artifacts

### D1. Source draft artifacts

| File | Content | Classification |
|------|---------|----------------|
| `validation-corpus/source-drafts/sprint-5a/pkg_6cd8ae39.source-draft.json` | `study_id: "test_study_001"` | SAFE_DELETE — stale generated artifact |
| `validation-corpus/source-drafts/sprint-5b/pubcand_72f7f184.publication-candidate.json` | `study_id: "test_study_001"` | SAFE_DELETE — stale generated artifact |

### D2. Parser results

`validation-corpus/parser-results/` contains ~40+ generated JSON files with generic protocol names (`PROTOCOL_A003.parser-result.json`, etc.). These are parser pipeline outputs from validation runs.

**Classification:** KEEP_FIXTURE — they are used by the protocol-intake test pipeline. Names are already generic.

### D3. Frozen validation corpus

`validation-corpus/frozen/` contains `validation-corpus-v1-manifest.json`, `checksums.csv`, etc.

**Classification:** KEEP_FIXTURE — frozen snapshot reference for reproducibility.

---

## 6. Category E — `.tmp/budgets_extract/` (Real Documents)

**Path:** `.tmp/budgets_extract/`  
**Contents:** ~50+ uploaded budget documents (PDFs, Excel files, Word docs) from real protocol budgeting

| Sample files | Risk |
|-------------|------|
| `GS-US-685-6819_10773_ToSite9%_19Nov24.xlsx` | May contain real protocol identifiers |
| `ADAMIS COVID Payments Records.xls` | May contain real patient/payment data |
| `CLINICAGENBIO_0606-01_BUDGET_ 30 NOV 2023_Draft (1).xlsx` | Real sponsor/vendor identifiers |

**Classification:** REVIEW_REQUIRED — these appear to be real uploaded budget documents used during development. They should be reviewed for sensitive data and removed from the repository if they contain proprietary information.

---

## 7. Category F — Remaining Scripts with Protocol References

| Script | Reference | Classification |
|--------|-----------|----------------|
| `scripts/protocol-to-source-closure-live.ts` | `latest.study.study_id`, `latest.study.protocol_number` | REVIEW_REQUIRED — live closure script with real study data |
| `scripts/protocol-to-source-e2e-smoke.ts` | Queries `protocol_runtime_studies` | REVIEW_REQUIRED — E2E smoke that may reference real data |
| `scripts/load-validation-protocol-001-runtime.mjs` | Loads `fixtures/validation-protocol-001/runtime-manifest.v1.json` | KEEP_FIXTURE — used to seed test fixtures |
| `scripts/load-validation-protocol-002-runtime.mjs` | Same pattern as above | KEEP_FIXTURE |
| `scripts/cleanup-fake-studies.ts` | Detects `smoke\|test\|demo\|synthetic\|qa\|mock` in study names | KEEP_OPERATIONAL — cleanup utility |
| `scripts/protocol-reconciliation-closure-smoke.ts` | References `validation-protocol-001/002` fixtures | KEEP_FIXTURE — smoke test scaffolding |

---

## 8. Classification Summary

| Classification | Count | Description |
|---------------|-------|-------------|
| SAFE_DELETE | ~6 | Stale docs, stale generated artifacts, obsolete smoke scripts |
| REPLACE_GENERIC | ~2 | Scripts with hardcoded study names that could use env vars |
| KEEP_FIXTURE | ~50 | Parser results, frozen corpus, test fixture loaders |
| KEEP_DOCUMENTATION | ~10 | Staging/validation docs explaining historical runs |
| REVIEW_REQUIRED | ~5 | Pilot fixture defaults, budget extracts, live closure scripts |

---

## 9. Proposed Second-Pass Cleanup Plan

### Phase 2A — Safe deletions

| File | Reason |
|------|--------|
| `docs/PARA_OA_012-OPERATIONAL-11F-A.md` | Stale doc, references non-existent fixture directory |
| `docs/MV40618-OPERATIONAL-11F-B.md` | Stale doc, references non-existent fixture directory |
| `validation-corpus/source-drafts/sprint-5a/pkg_6cd8ae39.source-draft.json` | Stale generated artifact (`test_study_001`) |
| `validation-corpus/source-drafts/sprint-5b/pubcand_72f7f184.publication-candidate.json` | Stale generated artifact (`test_study_001`) |
| `scripts/budget-negotiation-e2e-smoke.ts` | One-time E2E with hardcoded `subject-smoke` |
| `scripts/vip-adapter-smoke.ts` | One-time smoke with hardcoded protocol name |

### Phase 2B — Requires review

| File | Action |
|------|--------|
| `lib/runtime-validation/pilot-fixture-defaults.ts` | Review — contains real UUIDs + staging study identifiers |
| `.tmp/budgets_extract/` | Review — contains real documents that may have sensitive data |
| `scripts/protocol-to-source-closure-live.ts` | Review — live closure script |
| `scripts/seed-demo-financial.ts` | Review — demo seed with real fixture defaults |

### Phase 2C — Keep as-is

| Path | Reason |
|------|--------|
| `fixtures/validation-protocol-001/` | Active test fixtures |
| `fixtures/validation-protocol-002/` | Active test fixtures |
| `fixtures/intake-review/validation-protocol-001/` | Active test fixtures |
| `validation-corpus/parser-results/` | Active test fixtures |
| `validation-corpus/frozen/` | Reproducibility reference |
| `scripts/load-validation-protocol-*.mjs` | Fixture loaders used by CI |
| `scripts/cleanup-fake-studies.ts` | Database maintenance utility |

---

## 10. Remaining Risk Notes

1. **`.tmp/` is gitignored?** Check — if `.tmp/` is NOT in `.gitignore`, the budget extract documents are being version-controlled. These likely contain real sponsor names, protocol identifiers, and potentially patient-related financial data.
2. **`pilot-fixture-defaults.ts`** contains UUIDs that match actual staging database records. If the staging DB is reset, these become stale. Consider moving to env-var-only.
3. **`scripts/protocol-to-source-closure-live.ts`** queries real `protocol_runtime_studies` data and exports `protocol_number`. Should not be run against production.
4. **No hardcoded UI defaults found.** `app/` and `components/` contain no `defaultStudy`, `defaultProtocol`, or `fallbackStudy` values that reference real protocols.

---

## 11. No-Change Validation

```
git status           → 2 deleted scripts, audit reports (no new changes)
npx tsc --noEmit     → clean
npx vitest run       → 531/532 passed (1 pre-existing)
```

No files were modified during this audit. Ready for review.
