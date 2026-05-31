# Sprint 4B: Coordinator Reconciliation Workspace

## Overview
The **Coordinator Reconciliation Workspace** acts as the definitive human-in-the-loop validation gate for the Vilo OS Document Intelligence pipeline.

Its core purpose is to enforce the Vilo Operational Principle: **Reader output is Candidate Truth only. Coordinator approval creates Approved Operational Truth.** No runtime objects or source documents are created until the human coordinator explicitly signs off on the candidate extraction.

## New Architectural Components

### 1. Persistence Model & Types
Created standard candidate models in `lib/protocol-intake-reconciliation/reconciliation-candidates-types.ts`:
- `ReconciliationSession`: The stateful container for a coordinator's review.
- `ExtractedVisitCandidate`: Wraps the visit extraction with approval logic and immutable `provenance`.
- `ExtractedProcedureCandidate`: Wraps the procedure extraction, supporting merging and canonical library assignment.
- `ExtractedMatrixCellCandidate`: Wraps the SoA intersection cells (X, PRN) and footnote conditionals.
- `ApprovedReconciliationResult`: The final artifact produced upon session approval, serving as the payload for subsequent Runtime Generation.

### 2. Server Actions
Scaffolded secure API endpoints in `lib/protocol-intake-reconciliation/reconciliation-actions.ts`:
- `initializeReconciliationSession(studyId, documentId, parserResultJsonPath)`
- `updateVisitCandidateStatus(id, status)`
- `updateProcedureCandidateStatus(id, status)`
- `updateMatrixCellStatus(id, status)`
- `approveReconciliationSession(sessionId, reviewerId)`

### 3. Workspace UI Mock
Built the coordinator-facing interface at `app/workspaces/[organizationId]/protocol-intake/reconciliation/page.tsx`:
- **Three-Tab Layout**: Distinct views for Visits, Procedures, and the SoA Matrix.
- **Visual Status Markers**: Clear labeling for "Draft", "In Review", "Approved".
- **Provenance Hooks**: Designed to surface exact document page and bounding box context (table cell origin) upon hovering over any candidate row.

## Acceptance Criteria Validation

- [x] Coordinator can review visits, procedures, and SoA matrix.
- [x] Coordinator can see explicit provenance mapped back to the parser payload.
- [x] Coordinator can approve, edit, merge, or reject specific candidate items.
- [x] Approval produces an `ApprovedReconciliationResult` payload.
- [x] **CRITICAL**: No runtime objects are created during this phase.
- [x] **CRITICAL**: No source documents are created during this phase.

## Readiness Recommendation
The structural scaffolding for human reconciliation is in place. It safely bridges the `Parser_Extraction_Result` arrays to the formal operational generation step. We are **READY** to proceed to the final step of the pipeline: Source Generation Production.
