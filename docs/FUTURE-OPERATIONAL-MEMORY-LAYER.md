# Future Layer — Vilo Operational Memory

**Status:** Deferred architecture note.  
**Current scope:** Not part of Phase 12E Controlled Publish Pipeline.  
**Activation condition:** Only revisit after security, validation, permissions, concurrency, event integrity, source traceability, and controlled publish hardening are stable.

## Product Framing

Vilo OS should not build persistent chatbot memory.

The future opportunity is an **Operational Memory Layer**: audit-safe, scoped, longitudinal operational intelligence derived from real execution evidence.

This layer should accumulate institutional execution knowledge without becoming an uncontrolled notes system.

Correct framing:

- Institutional operational intelligence
- Audit-safe contextual retrieval
- Execution continuity infrastructure
- Longitudinal operational intelligence

Incorrect framing:

- AI memory
- Chatbot memory
- Assistant remembers everything
- Uncontrolled conversation logs
- Autonomous memory that writes operational truth

## Core Principle

Memory must be **evidence-based operational summarization**, not informal opinion.

Use:

```text
In the last 4 review cycles, PI signature median delay was 3.2 days.
Source: operational_events + signature timestamps.
```

Do not use:

```text
This PI is slow.
```

The memory layer must never become the source of truth. It is an interpretation, retrieval, and summarization layer derived from immutable runtime evidence.

## Why It Matters

Most CTMS products store records. They do not preserve operational learning.

The site learns something, then loses it:

- sponsor preferences
- PI behavior patterns
- coordinator habits
- recruitment friction
- site-specific execution patterns
- protocol edge cases
- recurrent monitor findings
- negotiation history
- patient navigation context

Vilo OS can create a defensible moat by preserving this learning as structured, traceable operational context.

## Layer 1 — Deterministic Operational Memory

No AI.

Use only deterministic, structured sources:

- `operational_events`
- audit/event logs
- signed actions
- monitor query history
- deviation patterns
- workflow timestamps
- source workflow state
- scoped coordinator notes, if explicitly attributable

Example output:

```text
Protocol STUDY-KOA-001
Common operational friction:
- Repeat monitor query on BP positioning
- Delays on HIT lab reconciliation
- Frequent window confusion on Visit 6

Derived from:
- 42 operational events
- 12 monitor queries
- 3 deviation patterns
```

Minimum requirements:

- source evidence
- actor attribution
- timestamp
- entity links
- visibility scope
- confidence or derivation method
- archival/retraction path

## Layer 2 — Context Retrieval

When a coordinator opens a sponsor, study, subject, visit, monitor, or procedure context, the system retrieves relevant prior operational memory.

Examples:

- known execution friction
- unresolved operational risks
- monitor behavior patterns
- historical resolutions
- prior study startup blockers
- recurring source or visit issues

This phase should not suggest autonomous actions. It should only contextualize.

## Layer 3 — Semantic Recall

Only after deterministic retrieval is stable, add semantic recall.

Recommended stack:

- Supabase Postgres
- `pgvector`
- async embedding jobs
- relational filters first
- vector similarity second

Retrieval must never be vector-only.

Context should combine:

- organization scope
- site scope
- role permissions
- blinding restrictions
- entity links
- recency
- structured event filters
- semantic similarity

## Layer 4 — Intelligence Layer

This is the strategic moat layer.

Possible capabilities:

- recurring operational failure detection
- sponsor/CRO behavioral patterns
- enrollment friction trends
- query recurrence prediction
- execution-risk surfacing
- study startup acceleration
- monitor finding recurrence summaries

This layer should remain evidence-grounded and explainable.

## Deferred Autonomous Pipeline

Fully autonomous execution is possible, but healthcare SaaS requires strict controls. The pipeline must avoid blind storage and uncontrolled memory accumulation.

The correct model is:

- deterministic curation by rules
- lightweight LLM summarization/scoring only after filtering
- semantic deduplication
- automatic pruning by TTL and importance
- silent audit metrics
- no blocking of primary clinical workflows

Conceptual background architecture:

```text
Raw operational logs
→ Queue
→ PHI / scope filter
→ Score and summarize
→ Merge or deduplicate
→ Embed and store
→ Auto-prune
→ Audit metrics
```

Possible execution pattern:

- Supabase Edge Function worker
- external cron trigger every 15 minutes
- existing AI routing configuration for low-cost scoring
- async embedding after deterministic validation
- fallback-safe behavior if the worker fails

The worker must never block:

- source capture
- submission
- signing
- enrollment
- publish preparation
- runtime execution

### Autonomous Limits

Initial guardrails should be conservative:

- maximum 50 active memory items per project or operational context
- default TTL of 90 days unless renewed by evidence
- minimum importance threshold before surfacing
- automatic archive for stale, unused, or contradicted memories
- no raw PHI in generated summaries
- no cross-organization memory retrieval
- no vector-only retrieval

Implicit feedback may adjust importance:

- repeated unanswered context need: lower usefulness/importance
- coordinator reuses or opens the memory: increase importance
- memory is ignored across repeated matching contexts: decay importance
- memory conflicts with newer source evidence: archive or supersede

### Audit Metrics

A future `memory_audit` or equivalent telemetry surface should track:

- worker run status
- items processed
- items rejected by PHI/scope filters
- items merged/deduplicated
- items archived
- retrieval precision feedback
- estimated AI/embedding cost
- drift indicators
- stale memory count

This audit layer should be operationally quiet but available for compliance and quality review.

### Cost Posture

The target cost posture should remain low because the memory layer is async, bounded, and selective.

The system should process only meaningful operational signals rather than every UI interaction or every conversation fragment.

Avoid:

- storing full chat transcripts as memory
- embedding every log line
- retaining low-confidence summaries indefinitely
- letting an LLM decide visibility or truth
- using autonomous memory as source-of-truth

Use:

- structured events first
- deterministic filters
- role and entity scope
- small summarization jobs
- deduplication before embedding
- pruning before scale

## Conceptual Data Model

Future tables may include:

- `memory_items`
- `memory_links`
- `memory_embeddings`
- `memory_events`
- `memory_feedback`

Minimal `memory_items` fields:

- `id`
- `organization_id`
- `memory_type`
- `entity_type`
- `entity_id`
- `title`
- `summary`
- `raw_content`
- `tags`
- `confidence_score`
- `visibility_scope`
- `source_event_ids`
- `created_by`
- `created_at`
- `archived_at`

## Pipeline

```text
Operational event
→ Normalize
→ Derive structured memory candidate
→ Link entities
→ Store evidence-backed memory item
→ Optionally embed asynchronously
→ Retrieve by scope/context
→ Collect feedback
```

## Regulatory And Security Rules

The memory layer must respect:

- tenant isolation
- organization scoping
- study/site scoping
- subject privacy boundaries
- blinding rules
- role-based visibility
- ALCOA+ attribution
- immutable event lineage
- source traceability

The layer must not:

- mutate clinical runtime truth
- replace source documents
- replace investigator judgment
- generate untraceable operational claims
- leak sponsor/site/subject context across scopes
- store informal judgments as facts

## Activation Gate

Do not implement this layer until the following are mature:

- controlled publish pipeline
- runtime permissions
- audit and event integrity
- source traceability
- concurrency protections
- validation gates
- role/blinding enforcement
- export/version lineage

Until then, this remains a future architecture layer.
