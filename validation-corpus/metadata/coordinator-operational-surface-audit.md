# Vilo OS — Coordinator Operational Surface Audit

## North Star Objective
Determine if a clinical research coordinator can execute a real study today without developer assistance, direct SQL access, or knowledge of the internal architecture.

---

## 1. Capability Matrix

| Section / Capability | Backend Status | UI Status | Coordinator Status | Evidence / Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **1. STUDY SETUP** |
| Create Study | EXISTS | MISSING | **NOT OPERATIONAL** | Requires DB seed/admin intervention. No self-serve "New Study" wizard. |
| Upload Protocol/Docs | EXISTS | VISIBLE | **OPERATIONAL** | Intake workspace allows document upload. |
| **2. DOCUMENT INTAKE** |
| Document Processing | EXISTS | VISIBLE | **PARTIAL** | Processing works (Phase 12C RAG), but error resolution UI for parse failures is limited. |
| **3. SOURCE GENERATION** |
| Generate Source | EXISTS | HIDDEN | **NOT OPERATIONAL** | RAG extracts data, but coordinator cannot easily "Approve & Publish" a generated eCRF via UI. |
| **4. SOURCE EDITOR** |
| Add/Edit/Remove Fields | MISSING | MISSING | **NOT OPERATIONAL** | No drag-and-drop form builder or source editor exists for the coordinator to fix parser mistakes. |
| **5. SUBJECT RUNTIME** |
| Create Subject / Consent | EXISTS | VISIBLE | **PARTIAL** | Subject Chart exists, but complex randomization cohorts/eligibility gating is not fully wired to UI forms. |
| **6. VISIT RUNTIME** |
| Open Visit / Enter Data | EXISTS | VISIBLE | **OPERATIONAL** | Visits tab and operational shell (Phase 7) allow data entry. |
| **7. eSOURCE RUNTIME** |
| Validation / Conditional Logic | PARTIAL | HIDDEN | **NOT OPERATIONAL** | Basic rendering exists, but complex cross-field validation rules are not surfaced or editable by CRC. |
| **8. PI/SI WORKFLOW** |
| Medical Review Routing | EXISTS | VISIBLE | **NOT OPERATIONAL** | Inbox UI exists (Sprint 3) but relies on Mock data. Not wired to persistent Supabase tables. |
| **9. GOVERNANCE INTEGRATION**|
| Policy/Authority Visibility | EXISTS | VISIBLE | **PARTIAL** | Command Center exists, but `evaluateExecutionGuard` is not hooked into real Next.js Server Actions (e.g. Save). |
| **10. FINALIZATION READINESS**|
| FINALIZE_VISIT | PARTIAL | VISIBLE | **NOT OPERATIONAL** | Dependencies like real DB persistence of PI signatures and eSource locks are missing. |

---

## 2. P0 Gaps (Critical Execution Blockers)
*Any gap preventing a coordinator from operating a real study today.*

1. **No Self-Serve Study Creation:** A CRC cannot initiate a study without developer SQL inserts.
2. **Disconnected Governance & PI Inbox:** The PI Medical Review Inbox and Site Defense Command Center are built, but use mock states. A CRC cannot actually request a PI signature that persists to the real Supabase DB and unlocks the Execution Guard.
3. **No Source Editor / Publisher:** If the AI extracts the protocol imperfectly, the CRC has no UI to manually correct, add, or delete fields before publishing the source document to the visit runtime.
4. **Execution Guard Not Hooked to Server Actions:** The guard mathematically works, but a CRC pressing "Save" on a visit does not trigger the real DB transaction interceptor yet.

## 3. P1 Gaps (Usability & Workload Multipliers)
*Issues that drastically increase CRC workload or cause confusion.*

1. **Opaque Parsing Failures:** If Document Intake fails to extract the Schedule of Activities correctly, the CRC cannot easily see *why* or retry a specific section.
2. **Missing Form Versioning UI:** If a protocol amends, the CRC cannot easily version the eSource via the UI without developer help.
3. **Hardcoded Form Validations:** CRCs cannot set field-level validation (e.g., Heart Rate > 100 flags as abnormal) through a UI; it requires backend configuration.

---

## 4. Recommendation

**B) Stop and complete Coordinator Operational Surface first**

**Rationale:** The Vilo OS engine is a masterpiece of clinical logic. The AI policy enforcement, the Medical Authority Matrix, and the Execution Guard are regulatory-grade. However, if a coordinator cannot create a study, fix an AI-generated source form, or get a real DB-persisted PI signature to unlock a visit, the engine is effectively a Ferrari without a steering wheel. We must wire the existing Mock UIs to Supabase and build the missing Source Editor before we can safely execute a `FINALIZE_VISIT` guard.
