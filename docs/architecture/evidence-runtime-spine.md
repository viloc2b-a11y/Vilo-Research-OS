# Evidence Runtime Spine

This document defines the architectural boundary for the Evidence Runtime Spine currently implemented on `genspark-runtime-closure`.

It exists to prevent future drift in runtime truth, evidence handling, publication authority, and operational review behavior.

## 1. Runtime Spine Overview

The implemented spine connects evidence-supported document workflows to runtime source execution through explicit human and publication boundaries:

```text
Protocol Intake
-> Reconciliation
-> Runtime Generation
-> Source Blueprint Evidence
-> Draft Suggestions
-> Signoff/Audit
-> Published Runtime Source
-> Visit Execution
-> Locked Snapshots
-> Operational Review
```

Each step has a bounded responsibility. Evidence may inform review, mapping, drafting, and audit workflows, but it does not bypass reconciliation, generation, publication, or visit execution gates.

## 2. Runtime Truth Boundaries

Runtime truth only comes from this path:

```text
approved reconciliation
-> runtime generation
-> published runtime source
```

Document Intelligence never becomes runtime truth directly.

Search results, extracted chunks, evidence rows, lineage mappings, draft suggestions, and signoff records are supporting operational evidence. They may guide coordinator review and source package preparation, but they are not authoritative runtime state until the approved runtime source publication path has completed.

## 3. Evidence Boundaries

Document Intelligence is:

- ingestion
- retrieval
- guidance
- evidence mapping
- drafting assistance

Document Intelligence is not:

- autonomous runtime generation
- automatic reconciliation approval
- automatic source publishing
- visit execution authority

Evidence records may support decisions, preserve provenance, and provide review context. They do not own runtime state.

## 4. Allowed Mutations

The Evidence Runtime Spine allows these mutations:

- evidence review state changes
- draft suggestion review changes
- active reference version changes
- runtime source package review
- manual publish workflows

These mutations are review, preparation, or publication-boundary mutations. They do not imply direct mutation of visit execution, reconciliation truth, locked snapshots, or previously published source artifacts.

## 5. Forbidden Mutations

The Evidence Runtime Spine forbids:

- evidence mutating runtime directly
- evidence auto-publishing source
- evidence auto-changing reconciliation
- draft suggestions modifying visit execution
- retrieval changing locked snapshots

Any implementation that allows evidence, retrieval, drafting, or search to directly alter runtime truth violates this boundary.

## 6. Active Reference Semantics

Document Intelligence versions are grouped into document families. A document family represents related versions of the same operational document within a study context.

Active reference versions define which ready document version is currently used for a domain such as source creation, budget review, regulatory review, operational guidance, or safety review.

Changing an active reference affects future retrieval and future evidence extraction only.

It does not:

- mutate runtime
- mutate published source
- mutate reconciliation
- mutate visit execution

When an active reference changes, existing evidence from older document versions is preserved. Evidence may be marked as `superseded_candidate` to require coordinator review, but provenance is not deleted or rewritten.

Immutable provenance preservation requires:

- retaining source document family identity
- retaining source document version identity
- retaining chunk and excerpt references
- retaining evidence review history
- retaining lineage mappings and review events

## 7. Publish Boundary

Only approved runtime source packages may publish.

Publish creates:

- `runtime_source_package_publications`
- signature placeholders
- publication events

Visit execution reads only from published runtime source.

Runtime source package review and evidence signoff can prepare or approve the package for publication, but publication itself remains an explicit workflow boundary. Evidence and draft suggestions do not publish source by themselves.

## 8. Auditability Principles

The spine depends on auditability as an operational control, not as a reporting afterthought.

Required principles:

- append-only operational events
- immutable lineage
- provenance traceability
- reviewer attribution
- deterministic state hashes
- no silent mutation

Every material state transition must leave a reviewable trail. Runtime-affecting state must be explainable through approved reconciliation, runtime generation, publication, visit execution, snapshot locking, and operational review records.

## 9. Coordinator-First Constraints

The Evidence Runtime Spine is coordinator-first.

Constraints:

- no fake AI language
- manual review required
- advisory drafting only
- operational transparency
- no cross-study leakage

The system may assist coordinators by retrieving evidence, preserving provenance, suggesting drafts, and surfacing review context. It must not pretend advisory output is authoritative, hide uncertainty, cross study boundaries, or replace human review where the workflow requires it.
