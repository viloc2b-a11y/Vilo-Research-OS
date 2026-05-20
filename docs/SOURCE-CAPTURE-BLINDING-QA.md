# Source Capture Blinding QA

End-to-end QA for `blinding_scope` on source fields (migration `0060`) against real capture/review flows.

## Setup

```bash
npm run db:seed-rbac-blinding-qa          # RBAC QA users (if not already)
npm run db:seed-source-capture-blinding-qa
npm run db:validate-source-capture-blinding-qa
npm run db:validate-source-capture-blinding-qa:live   # requires dev server + NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Fixture written to: `tmp/source-capture-blinding-qa-fixture.json`

Password for QA users: `RbacBlindingQa!2026`

## Test fields

| field_key | blinding_scope | Purpose |
|-----------|----------------|---------|
| `qa_blinded_field` | `blinded` | Visible to blinded coordinators |
| `qa_unblinded_field` | `unblinded` | Hidden from blinded; requires unblinded role |

Seeded on an unsigned `procedure_execution` with a published `source_definition_version` (trigger disabled briefly on staging only).

## QA matrix (expected)

| Persona | Visible fields | Save blinded | Save unblinded | Submit w/ unblinded draft | Sign procedure (has unblinded fields) | Mutate (correct/addendum) |
|---------|----------------|--------------|----------------|---------------------------|----------------------------------------|---------------------------|
| research_coordinator | blinded only | yes | no (403) | no | no | yes blinded only |
| data_coordinator | blinded only | yes | no | no | no | yes blinded only |
| unblinded_coordinator | both | yes | yes | yes | yes | yes |
| unblinded_cra | both | no | no | no | no | no (monitor) |
| pi_sub_i | blinded only | yes | no | no | **no** (unblinded on procedure) | yes blinded only |
| read_only | blinded only | no | no | no | no | no |
| owner | both | yes | yes | yes | yes | yes |

Static validation also checks **audit trail**, **findings**, and **corrections/addenda** redaction for blinded personas.

## Live API checks (`--live`)

Per persona (except read_only): open response set → GET detail field keys → POST save-draft (blinded / unblinded).

## Unresolved risks

- QA fields inserted via disabled trigger on **published** SDV; production should use draft SDV authoring or publish pipeline.
- `published_source_fields.blinding_scope` not synced in seed (read path uses `source_fields`).
- Browser E2E for review page / correction UI not automated in this script.
- Multi-role union (`roles[]`) not covered in this fixture (see `db:validate-rbac-blinding-qa`).
