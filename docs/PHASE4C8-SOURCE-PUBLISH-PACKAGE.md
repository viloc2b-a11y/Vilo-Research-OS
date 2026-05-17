# Phase 4C.8 — Source Definition Publish Package (skeleton)

**Status:** Implemented (file-based publish package; no database persistence).

**Parents:** [`PHASE4C7-SOURCE-PREVIEW-APPROVAL-GATE.md`](./PHASE4C7-SOURCE-PREVIEW-APPROVAL-GATE.md) · [`PHASE4C5-SOURCE-DEFINITION-COMPILER.md`](./PHASE4C5-SOURCE-DEFINITION-COMPILER.md)

**Core principle:** Nothing becomes publishable unless the approval artifact has `publish_eligible: true` and all integrity checks pass. The publish package is the **immutable handoff** artifact for future Phase 4A database persistence.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged.

---

## A. Purpose

```text
source-definitions.json + source-preview.md + source-preview-approval.json
  →  build-source-publish-package.mjs
  →  source-publish-package.json
```

Bundles approved compiler output with approval evidence, hashes, counts, and publish checks.

---

## B. Why publish package exists

| Stage | Role |
|-------|------|
| Compiler output | Machine-generated proposal |
| Preview | Human-readable review |
| Approval | Explicit human decision + eligibility |
| **Publish package** | Verified bundle ready for persist adapter |

Separates *approved for publish* from raw compiler JSON. Future Phase 4A adapter consumes only packages with `publish_ready: true`.

---

## C. Inputs/outputs

| Argument | Default |
|----------|---------|
| `--source-definitions` | `tmp/compiled/source-definitions.golden-basic.json` |
| `--preview` | `tmp/compiled/source-preview.golden-basic.md` |
| `--approval` | `tmp/approvals/source-preview-approval.golden-basic.json` |
| `--output` | `tmp/publish/source-publish-package.golden-basic.json` |
| `--strict` | Exit `1` when `publish_ready === false` |

```bash
npm run build:publish-package:golden
```

Golden pipeline:

```bash
npm run compile:source:golden
npm run render:source-preview:golden
npm run approve:source-preview:golden
npm run build:publish-package:golden
```

---

## D. Publish readiness rules

`publish_ready: true` when **all** publish checks are `pass` or `warning` (no `fail`):

1. `approval.publish_eligible === true`
2. Hashes match approval recorded values
3. `graph_id` and `input_hash` align
4. No validation errors in source definitions
5. Approval decision is `approved`
6. Artifact paths exist
7. Counts present and non-empty

Does **not** write to DB. Does **not** mutate input artifacts.

---

## E. Hash matching strategy

| Hash | Computed from |
|------|----------------|
| `source_definitions_hash` | SHA-256 of source-definitions file bytes |
| `preview_hash` | SHA-256 of preview Markdown bytes |
| `approval_hash` | SHA-256 of approval JSON bytes |

Compared to values stored in the approval artifact at review time.

---

## F. Publish checks

| Code | Requirement |
|------|-------------|
| `ARTIFACT_PATHS_PRESENT` | All three input files exist |
| `APPROVAL_ELIGIBLE` | `publish_eligible === true` |
| `APPROVAL_DECISION_APPROVED` | `decision === approved` |
| `SOURCE_HASH_MATCH` | Approval hash = computed |
| `PREVIEW_HASH_MATCH` | Approval hash = computed |
| `GRAPH_ID_MATCH` | Approval = source definitions |
| `INPUT_HASH_MATCH` | Approval = source definitions |
| `NO_VALIDATION_ERRORS` | `validation_report.errors` empty |
| `COUNTS_PRESENT` | All count keys present, SDV > 0 |
| `VALIDATION_WARNINGS_ACKNOWLEDGED` | Warning if warnings exist (passes when approval eligible) |

---

## G. Current limitations

- Package does not embed full source-definitions payload (paths + hashes only)
- No cryptographic signing of package
- No Supabase storage or Phase 4A INSERT
- `created_at` inherits `approval.reviewed_at` (changes if approval re-run)
- No diff vs previously published package version

---

## H. Exact next step

1. **Phase 4A persist adapter** — read `publish_ready` package, verify hashes, INSERT `source_definition_versions` / related tables
2. **CI gate** — golden pipeline ends with `build:publish-package:golden --strict`
3. **Optional tarball** — package + referenced files as signed archive

---

*Regulatory-informed engineering posture only.*
