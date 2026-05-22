# Phase 10 — Source Runtime Execution Continuity

**Study:** PHASE9A-PILOT-001 · **Visit:** Screening · **Procedure:** CBC  
**Procedure execution:** `c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc`  
**Published SDV:** `2ee5a544-fba6-4edb-a5c1-61ba5e2eee00` · **Package:** `pkg_47e6c6186bb4`

## 1. Root cause

Published SDV (definition code `D1`, package-bound, no `source_engine_template_id` in meta) did not map to an executable registry template. Resolution fell through to **generic dev fallback**, which:

- Rendered a non-clinical field mix and engine sections unrelated to the published capture manifest
- Ran **full OA template submit validation** (demographics, vitals sections not on the SDV) and blocked submit
- Left `completion_status` with `{ list_code: "EPRO_STATUS" }` unresolved → select showed only "—"
- Treated required booleans as failing when unchecked checkboxes omitted `on` from `FormData` (`raw === null`)

`READY_FOR_EXECUTION` passed because it checks binding/lifecycle, not executable template continuity.

## 2. Failure path

```
procedure_source_binding → published SDV
  → resolveSourceEngineTemplateForProcedure
      → no meta template key, code D1, no overlap heuristic
      → buildFallbackConfig()  ❌
  → loadCaptureShell: renders capture with fallback warning
  → applyEngineRuntimeToCaptureFields (full template rules)
  → submitCaptureAction
      → validateProcedureSourceForSubmit (no runtimeConfig)  ❌ blocks on off-form fields
      → parseCaptureFormToResponses: boolean required + disabled skip  ❌
```

## 3. Files changed

| File | Change |
|------|--------|
| `lib/source-engine/resolution/load-resolution-context.ts` | Load `publishedFieldKeys` from `source_fields` |
| `lib/source-engine/resolution/source-template-resolver.ts` | `resolvePublishedExecutableRegistry()` → `GENERIC_OA_PHASE3_TEMPLATE` when package + fields |
| `lib/source/capture/resolve-field-options.ts` | **New** — `list_code` → option arrays (EPRO_STATUS, AE_REL, …) |
| `lib/source/capture/normalize-capture-fields.ts` | Use `parseCaptureFieldOptions` |
| `lib/source/capture/validate-capture-fields.ts` | **New** — submit validation scoped to visible capture fields only |
| `lib/source/capture/parse-form.ts` | Boolean required fix; disabled boolean persistence |
| `lib/source/capture/load-capture-shell.ts` | Hard-fail published+fallback; template-scoped engine runtime |
| `lib/source/capture/actions.ts` | Capture-scoped submit validation; block published+fallback submit |
| `lib/source-engine/adapters/capture-runtime-adapter.ts` | Template-scoped `disabled`/`required` overrides |
| `lib/source-engine/operational/smoke-tests.ts` | `publishedFieldKeys` default in test context |

## 4. Resolver continuity fix

- Published package + manifest field keys → registry template via overlap or **default `GENERIC_OA_PHASE3_TEMPLATE`**
- Definition code `D1` also maps to OA template in registry path
- Published + fallback → **error shell** (no silent dev capture)

## 5. Field executability fix

- Coded selects resolve to clinical option lists
- Engine `disabled`/`required` only applied for fields in **registry template field ids**
- Submit validates **capture fields only** (`validateCaptureFieldsForSubmit`)
- Disabled booleans still serialize from loaded values when UI cannot post `on`

## 6–7. Submit / signature verification

**Automated:** `node scripts/validate-operational-spine-phase9.mjs` — 11/11 PASS (pilot CBC still `validation_status: incomplete` until human submit).

**Browser re-run (post-patch):**

| Step | Result |
|------|--------|
| Capture opens | PASS — `Template: published · GENERIC_OA_PHASE3` |
| `completion_status` options | PASS — completed / partial / not_done / not_applicable |
| Coded AE/IP selects | PASS — relatedness, route, seriousness, severity |
| Save and submit | **PARTIAL** — first attempt failed: `ae_present` / `epro_completed` / `ip_administered` required (disabled checkboxes not posted); additional parse-form + runtime patch applied |

**Signatures:** Not re-verified end-to-end in this session after final parse-form patch. Requires human re-run: submit → coordinator sign → PI sign on visit `6690da63-4bf1-4681-815a-3e39b7b014bc`.

## 8. Fallback runtime

- **Still exists** for unpublished / dev SDVs without package binding
- **Blocked** for coordinator capture when `lifecycle_status === 'published'` or `publishedPackageId` is set

## 9. READY_FOR_EXECUTION

- **Unchanged** in phase9 script — still binding/lifecycle oriented
- Executable continuity is enforced at **capture shell load** and **submit** instead

## 10. Re-run (PHASE9A-PILOT-001 / Screening / CBC)

After hot reload, re-test:

1. Open capture — confirm published template banner (not fallback)
2. Fill heart_rate, completion_status, conditional AE/ePRO/IP fields
3. Save and submit → **Submitted: yes**
4. Visit → Sign Procedure (coordinator) → investigator signature

---

## Final verdict

**Can a human CRC complete capture → submit → sign without engineering intervention?**

**LIKELY YES after one more live re-run** — resolver, options, and submit validation defects are patched; first browser submit exposed disabled-checkbox POST gap (fixed in `parse-form.ts` + template-scoped engine runtime). **Operational Spine closure** should follow confirmation of submit + dual signatures on the pilot path above.

**STOP** — no roadmap expansion.
