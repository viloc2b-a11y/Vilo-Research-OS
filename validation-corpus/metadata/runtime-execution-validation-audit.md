# Vilo OS — Runtime Execution Validation Audit

## North Star Objective
Determine if a Clinical Research Coordinator (CRC) can execute a complete study visit inside Vilo OS from start to finish (Open Visit → Execute Procedures → Capture Data → Finalize), without developer intervention.

---

## 1. Runtime Capability Matrix

| Area | Component | Status | Evaluation Notes |
| :--- | :--- | :--- | :--- |
| **VISIT WORKSPACE** | Visit Overview | **OPERATIONAL** | Shell exists. Coordinators can view subject, schedule, and open tasks. |
| | Procedure List | **OPERATIONAL** | Procedures assigned to a visit display correctly. |
| | Alerts | **PARTIAL** | Command Center shows risk, but inline UI alerts during execution are disconnected. |
| **SOURCE EXECUTION** | Form Rendering | **PARTIAL** | Static components exist, but dynamic rendering of JSONB forms from the new *Source Studio MVP* is missing. |
| | Data Capture | **NOT OPERATIONAL** | Input fields exist visually, but the binding to a persistent subject-visit data model is incomplete. |
| | Validation Rules | **MISSING** | Field-level validation (min/max, required) doesn't fire real-time blocks in the UI. |
| **PERSISTENCE** | Save Draft | **NOT OPERATIONAL** | The visit cannot be saved as a cohesive draft state to Supabase yet. |
| | Recover Session | **MISSING** | If the browser crashes, unsaved field inputs are lost. |
| **AUDIT TRAIL** | User Attribution | **PARTIAL** | The framework exists, but field-level audit trails (ALCOA+) are not bound to individual keystrokes/saves. |
| **GOVERNANCE** | Finalization Guard | **NOT OPERATIONAL** | Cannot click "Finalize Visit" and have it successfully hit `evaluateExecutionGuard` due to missing Server Action hooks. |

---

## 2. Runtime Friction Report

- **Context Switching:** High. Coordinators can view procedures but must mentally map them to the forms if the UI does not explicitly link a procedure to its eSource section.
- **Click Count:** Low to Medium. Navigation is relatively flat, but the lack of auto-saving increases manual "Save Draft" clicks.
- **Operational Burden:** Extreme. Because data persistence is not functioning at the form level, the coordinator would have to revert to paper, defeating the purpose of the platform.

---

## 3. P0 Runtime Gaps (Critical Blockers)
1. **No eSource Form Renderer:** We built the *Source Studio MVP* to create blueprints, but we lack the `SourcePlayer` or `VisitExecutionEngine` to render those dynamic blueprints and capture `subject_visit_data` in the database.
2. **Missing Persistence Layer:** Capturing data currently has no robust Supabase mutation. Without saving, a visit cannot be executed.
3. **Execution Guard Disconnect:** The `FINALIZE_VISIT` action is not physically wired to the database transaction, meaning a visit cannot be formally closed.

## 4. P1 Runtime Gaps (Usability & Safety)
1. **Lack of Auto-Save:** Real clinical visits suffer interruptions. A lack of auto-save or session recovery risks massive data loss for the coordinator.
2. **Missing Field-Level Audit Trail:** To be GCP compliant, every data point captured needs an ALCOA+ audit log (who entered it, when, and if changed, why). This table structure is currently missing from the runtime execution path.

---

## 5. Final Verdict

**Can a coordinator execute a complete visit inside Vilo OS today?**

### NO.

**Rationale:** While the Visit Workspace shell exists and the Governance logic is mathematically sound, the **Source Execution Layer** (the actual form rendering and data persistence) is not operational. A coordinator can open a visit, but they cannot actually capture, save, and formally finalize the clinical data for that visit in a persistent, audit-compliant manner. The next immediate requirement is the **Visit Execution Engine / Source Renderer**.
