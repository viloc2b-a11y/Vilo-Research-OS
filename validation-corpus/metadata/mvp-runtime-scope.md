# MVP Runtime Scope for First Production Pilot

## 1. Core Philosophy
Do not build the entire intelligence suite. Prioritize Site Protection (Hard Stops for Safety) and Audit Defensibility (PI Oversight). Delay Financial and Query Prediction.

## 2. MVP Must-Have Scope

### A. Must-Have Runtime Objects (Database)
- `site_defense_alerts`: A ledger to track active alerts, their severity, and their throttling state.
- `medical_adjudications`: A table tracking PI decisions (CS/NCS) on abnormal clinical data.

### B. Must-Have UI Surfaces
- **The Defense Banner:** A non-intrusive global UI banner to display `ADVISORY` and `WARNING` alerts.
- **The Execution Guard Modal (Hard Stop):** A modal that intercepts a Server Action (e.g., `saveVisitData`) if the VIP Engine returns a `HARD_STOP` violation, forcing resolution (or dual-signature) before continuing.
- **PI Oversight Inbox:** A simple list view for the PI to click "Clinically Significant" or "Not Clinically Significant."

### C. Must-Have Approval Gates
- **PI Adjudication Gate:** Locks Visit Finalization until the PI clears all safety flags.
- **Double-Signature Gate:** For Pharmacy/Inventory destruction or high-risk overrides.

### D. Excluded from MVP (Out of Scope)
- ClinIQ Financial API integrations.
- NLP-based EMR Source Document cross-checking (use manual file uploads instead).
- Predictive workload tracking for Coordinators.
