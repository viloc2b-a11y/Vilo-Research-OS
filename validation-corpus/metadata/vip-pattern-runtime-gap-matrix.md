# VIP Pattern Runtime Gap Matrix

*Note: This is a representative matrix of critical pattern types based on the 100+ candidates.*

| Pattern ID | Domain | Runtime Object | UI Surface | Event Support | Approval Gate | Hard Stop | Integration | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `VIP_PAT_HRD_002` (Physical Mismatch) | Pharmacy | IP Ledger | Discrepancy Modal | Missing | 2-Signature | Missing | None | **NOT_SUPPORTED** |
| `VIP_PAT_HRD_006` (CS/NCS Adjudication) | Clinical | Visit Event | PI Override Modal | Missing | PI e-Sign | Missing | None | **NOT_SUPPORTED** |
| `VIP_PAT_GAP_002` (ISF Sync) | Defense | Document | Alert Banner | Supported | Coord. Ack. | N/A | None | **PARTIALLY_SUPPORTED** |
| `VIP_PAT_HRD_011` (ClinIQ Dollar Amt) | Financial | CTA Object | Finance Dashboard | Missing | N/A | N/A | ClinIQ API | **NOT_SUPPORTED** |
| `VIP_PAT_HRD_013` (Alert Throttling) | Alerting | Alert State | Defense Digest | Missing | N/A | N/A | None | **NOT_SUPPORTED** |
| `VIP_PAT_PHARM_001` (Temp Excursion) | Pharmacy | Log Event | Quarantine Lock | Missing | PI Approval | Missing | TempLogger API | **NOT_SUPPORTED** |

## Conclusion
Almost all patterns rely on two non-existent UI/UX elements:
1. The **Site Defense Alert Surface** (To display warnings and throttle them).
2. The **Hard Stop / Verification Modal** (To block clinical execution until an action like CS/NCS or 2-Signature verification is completed).
