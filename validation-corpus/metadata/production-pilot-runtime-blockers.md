# Production Pilot Runtime Blockers

## 1. Overview
To run a safe Production Pilot, Vilo OS cannot simply be a passive data-entry tool; it must act as the Site Defense Engine. Currently, critical execution gaps block the safe deployment of the pilot.

## 2. Blockers

### A. The "Hard Stop" Barrier (BLOCKER)
- **Gap:** No UI/Middleware to physically prevent a user from submitting data when a Critical intelligence pattern is triggered.
- **Risk:** VIP knows a patient is ineligible, but the coordinator can still click "Randomize."
- **Required:** A generic `InterventionModal` component and server-action middleware guard.

### B. Medical Authority PI Override (BLOCKER)
- **Gap:** No workflow for the PI to legally adjudicate Clinical Significance (CS/NCS).
- **Risk:** FDA 483 for Lack of Oversight. The AI flags an abnormal lab, and it sits there unresolved.
- **Required:** `PI_Adjudication_Dashboard` and `Sign-Off` API.

### C. Site Defense Alert System & Throttling (HIGH)
- **Gap:** No component exists to show VIP warnings (WARNING/ADVISORY).
- **Risk:** Alert fatigue or total ignorance of risk.
- **Required:** `SiteDefenseToast` and an `AlertStateLedger` to manage throttling rules (e.g., suppressing duplicate warnings).

### D. Query State Ledger (HIGH)
- **Gap:** Queries are conceptually defined but cannot be created, tracked, or aged in the DB.
- **Risk:** Cannot measure workload or aging risks.
- **Required:** `queries` DB table and `QueryResolution` UI.

### E. Financial API / ClinIQ (MEDIUM)
- **Gap:** Financial uncertainty patterns are ready, but there is no external adapter to pull the CTA.
- **Risk:** Revenue protection features are offline.
- **Required:** Not a Day-1 blocker, but required for Phase 2 scaling.
