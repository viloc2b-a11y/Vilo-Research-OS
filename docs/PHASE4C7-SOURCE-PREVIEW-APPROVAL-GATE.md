# Phase 4C.7 — Source Preview Approval Gate (skeleton)

**Status:** Implemented (file-based approval artifact; no database persistence).

**Parents:** [`PHASE4C6-SOURCE-PREVIEW-RENDERER.md`](./PHASE4C6-SOURCE-PREVIEW-RENDERER.md) · [`PHASE4C5-SOURCE-DEFINITION-COMPILER.md`](./PHASE4C5-SOURCE-DEFINITION-COMPILER.md)

**Core principle:** Generated source definitions cannot become regulated/published source definitions without **explicit human review and approval**. Compiler and AI output may propose; a human must approve.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged.

---

## A. Purpose

```text
source-definitions.json + source-preview.md
  →  approve-source-preview.mjs (human CLI)
  →  source-preview-approval.json
```

Records who reviewed compiler output, what they decided, and whether the bundle is **publish-eligible** for a future Phase 4A persist step.

---

## B. Why approval gate exists

| Without gate | With gate |
|--------------|-----------|
| Compiler output could be mistaken for approved source | Approval artifact separates *draft_generated* from *human-approved* |
| No audit trail of reviewer intent | `reviewer_user_id`, `reason`, `reviewed_at`, hashes |
| Warnings ignored silently | Warnings must be acknowledged in reason/comments for `approved` |

This is a **skeleton** — file-based only. No UI, no RPC, no DB writes.

---

## C. Input/output

| Argument | Default |
|----------|---------|
| `--source-definitions` | `tmp/compiled/source-definitions.golden-basic.json` |
| `--preview` | `tmp/compiled/source-preview.golden-basic.md` |
| `--output` | `tmp/approvals/source-preview-approval.golden-basic.json` |

```bash
npm run approve:source-preview:golden
```

Golden pipeline:

```bash
npm run compile:source:golden
npm run render:source-preview:golden
npm run approve:source-preview:golden
```

---

## D. Required flags

| Flag | Required | Description |
|------|----------|-------------|
| `--reviewer-user-id` | Yes | Reviewer identity (skeleton accepts opaque IDs) |
| `--decision` | Yes | `approved` \| `rejected` \| `needs_changes` |
| `--reason` | Yes | Human rationale for decision |
| `--reviewer-role` | No | e.g. `PI`, `CRA` |
| `--comments` | No | Additional review notes |

Missing required flags → usage printed, exit `1`.

**No auto-approval** — script never runs without explicit `--decision` and `--reason`.

---

## E. Publish eligibility rules

`publish_eligible: true` only when **all** of:

1. `decision === "approved"`
2. `validation_snapshot.errors` is empty
3. `source_definitions_hash` and `preview_hash` computed
4. `reviewer_user_id` present
5. `reason` non-empty
6. If warnings exist: `reason` or `comments` acknowledges warnings (contains `warning` case-insensitive, or non-empty reason/comments)

**Blocked at CLI (exit 1):**

- `--decision approved` when validation errors exist
- `--decision approved` with warnings but no acknowledgment in reason/comments

---

## F. Hash/provenance model

| Field | Source |
|-------|--------|
| `source_definitions_hash` | SHA-256 of source-definitions file bytes |
| `preview_hash` | SHA-256 of preview Markdown file bytes |
| `approval_id` | `spa_` + 12-char hash of `(source_definitions_hash, reviewer_user_id, decision, reason_hash)` |
| `graph_id`, `input_hash`, `compiler_output_id` | Copied from compiler output (read-only) |
| `validation_snapshot` | Copy of `validation_report` at review time |
| `provenance.approval_gate_version` | `0.1.0` |

Compiler output and preview files are **not mutated**.

---

## G. Current limitations

- No Supabase / Phase 4A persistence of approvals
- No multi-reviewer workflow or e-signature
- No integration with workbook import approval state
- `reviewer_user_id` not validated against auth directory
- Re-running approval overwrites output path only (no append-only audit log)
- `reviewed_at` is wall-clock (not hash-derived)

---

## H. Exact next step

1. **Phase 4A publish adapter** — require matching `approval_id` + hashes before INSERT to `source_definition_versions`
2. **CI gate** — fail publish job if `publish_eligible !== true`
3. **Optional** — validate approval artifact against extended JSON schema

---

*Regulatory-informed engineering posture only.*
