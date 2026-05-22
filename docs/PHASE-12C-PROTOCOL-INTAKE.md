# Phase 12C — Protocol Intake to Source Draft Pipeline

**Status:** Draft-only intake pipeline. No publish, bind, or runtime mutation.

**Module:** `@/lib/protocol-intake`  
**Fixtures:** `fixtures/protocol-intake/`  
**Smoke:** `npx tsx scripts/phase12c-intake-smoke.ts`  
**Preview:** `/source-builder/intake`

## Flow

```
Document → Adapter → Corpus → Normalize (pages/sections/tables/footnotes)
  → Hybrid retrieval + evidence gates → Deterministic extractors
  → Cross-check + conflict detection → Source composition / VPI / ClinIQ drafts
  → Review summary (JSON + Markdown)
```

**Never:** Document → auto-published runtime

## Phase 12C addendum (evidence-first)

1. **Normalization** — `enrichIntakeCorpus()` splits narrative, tables (with coordinates), headings, footnotes.
2. **Hybrid retrieval** — keyword + lightweight semantic + table/section-aware (`rag/retrieval.ts`). Evidence retrieved before confidence gates.
3. **Deterministic-first** — regex/line extractors unchanged; LLM not required (optional hook reserved for future).
4. **Evidence gates** — high confidence only when snippet supports value; footnote dependencies flag review.
5. **Cross-checks** — metadata, visit counts, SoA rows, binding readiness, eligibility sanity, footnote↔procedure.
6. **Conflicts** — disagreeing sources surfaced in `review.conflicts` and `intake_conflicts`; never silent merge.
7. **Coordinator UI** — Found / Needs review / Missing / Conflicts / Recommended sections only (no embeddings, chunks, prompts).

## Draft objects

- Study metadata, eligibility, schedule, procedures
- Source composition recommendations (12A libraries + overlays)
- VPI and ClinIQ input drafts
- Coordinator review lists: Found / Needs review / Missing / Conflicts / Recommended source sections
- Per-field `evidence[]`, `confidence`, `reviewer_required`

## Safety

`PROTOCOL_INTAKE_SAFETY`: `auto_publish: false`, `auto_bind: false`, `mutates_runtime: false`

Publish immutability unchanged: only explicit publish flows freeze SDV snapshots (12B `provenance_json`).

## Limitations (12C)

- No OCR — expects pre-extracted text or fixtures
- No external embedding API — semantic channel is deterministic token overlap
- LLM extraction optional/future; deterministic path is authoritative
- No automatic study/runtime row creation
