# Phase 12D — Source Builder Human Review Workspace

**Status:** Review, edit, and approve intake drafts in Source Builder. No publish, bind, or runtime mutation.

## Entry points

- Source Builder home → **Review protocol intake drafts** (`/source-builder/intake`)
- Review workspace → `/source-builder/intake/review/[draftKey]`

## Draft sources

Discovers packages with `manifest.json` under:

- `fixtures/intake-review/`
- `.phase12c-py-smoke/` (local Python output)
- `VILO_INTAKE_DRAFTS_DIR` (optional env)

Review state and approved artifacts: `data/intake-review-workspaces/{draftKey}/`

## Reviewer states

`pending` · `accepted` · `edited` · `rejected` · `needs_clarification`

Low-confidence / conflict items default to `needs_clarification`. Section approval requires explicit decisions on all items.

## Approved handoff

`Generate approved draft` writes:

- `approved_intake_draft.json`
- `review_audit.json`

Hardcoded safety: `auto_publish: false`, `auto_bind: false`, `runtime_mutation: false`.

## Smoke

```bash
node scripts/seed-phase12d-fixture.mjs   # optional: refresh fixtures/intake-review/para-oa-012
npx tsx scripts/phase12d-intake-review-smoke.ts
```
