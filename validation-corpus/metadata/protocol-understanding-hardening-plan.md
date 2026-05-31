# Protocol Understanding Hardening Plan

## Core Principle
**No protocol element may be evaluated in isolation.** The Vilo OS Protocol Understanding Engine must construct a unified knowledge model before answering coordinator questions or generating source drafts.

## 1. Unified Knowledge Model Architecture
To move beyond SoA-only extraction, the pipeline will be upgraded to index and correlate the following required evidence sources into a unified entity graph:
- **Narrative Context:** Synopsis, Study Design, Study Flow, Objectives, Endpoints.
- **Subject Guardrails:** Inclusion Criteria, Exclusion Criteria, Contraception Rules.
- **Operational Execution:** Visit Descriptions, Procedure Descriptions, Safety Assessments, Imaging/Ophthalmology/Laboratory Requirements.
- **Structural Definitions:** Schedule of Activities, Footnotes, Notes Columns.
- **External Dependencies:** Amendment Changes, eCRF Guidance, External Manuals.

## 2. Intelligence Rules Enforcement

### Contextual Resolution
When identifying a procedure (e.g., from the SoA), the engine must autonomously execute a semantic search across the full protocol body to determine:
- **Why** the procedure exists (Clinical rationale).
- **When** it is required (Timing nuances not visible in the grid).
- **Who** requires it (Cohort/Sub-study/Gender restrictions).
- **Eligibility Implications** (Does a certain result cause a screen fail?).
- **Safety Implications** (Is this procedure monitoring a known toxicity?).
- **Deviation Implications** (Is there a hard stop if this is missed?).
- **Source Documentation Implications** (What specific worksheets/eCRFs need to capture this data?).

### Confidence Thresholds
A `HIGH` confidence rating is mathematically locked and cannot be assigned to any answer or generated Source Worksheet unless **multiple independent protocol sections** corroborate the conclusion (e.g., SoA + Section 8 Procedure Descriptions + Section 5 Exclusion Criteria).

## 3. Implementation Workflow (Next Steps)
1. **Semantic RAG Ingestion:** Feed the full PDF text payload of the `validation-corpus/sanitized` documents into a Document Intelligence vector index, tagging chunks by Section Type (Safety, Eligibility, Schedule).
2. **Reconciliation Context Injection:** When a coordinator views the Reconciliation Workspace, hovering over an SoA cell will not only show the bounding box, but will fetch and display the narrative `Procedure Description` and `Safety Implication` from the protocol body.
3. **Coordinator QA Agent:** Deploy a specialized QA prompt that strictly enforces the "Never answer using only SoA evidence" rule, requiring explicit citation mapping to narrative sections before surfacing an answer to a clinical user.
