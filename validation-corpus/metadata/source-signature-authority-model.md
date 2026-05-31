# Source Signature Authority Model

This model defines the distinct roles and signatures required for the lifecycle of a clinical source document in Vilo OS.

## 1. Core Signature Roles
- **Performed By:** The individual who executed the action (e.g., CRC taking vitals, Phlebotomist drawing blood).
- **Reviewed By:** The operational supervisor verifying completeness (e.g., Senior CRC, Clinical Manager).
- **Medical Adjudicated By:** A medically qualified individual (PI/SI) determining clinical significance (CS/NCS).
- **Visit Medical Review By:** The PI (or SI) signing off on the aggregate visit data.

## 2. Risk-Based Oversight Rules
- **Do not require PI signature on every visit:** Routine visits without adverse events, medication changes, or abnormal findings may be operationally reviewed and auto-closed.
- **Require PI/SI review only where authority matrix indicates:** E.g., if a lab is attached to the visit, the visit remains open until the PI/SI adjudicates the lab.
- **Prevent rubber-stamp oversight:** Batch-signing is disabled for Critical Medical events (Eligibility, SAEs). Each must be opened and individually signed with a rationale.

## 3. Source Execution Flow
1. **Creation:** CRC generates EDC-mapped source.
2. **Execution:** CRC/RN performs and signs (`Performed By`).
3. **Intelligence Scan:** VIP scans source. If abnormal flags trigger `PI_REQUIRED` authority boundaries, the document locks.
4. **Adjudication:** PI receives inbox alert, reviews, and signs (`Medical Adjudicated By`).
5. **Finalization:** Execution Guard clears the visit for finalization.
