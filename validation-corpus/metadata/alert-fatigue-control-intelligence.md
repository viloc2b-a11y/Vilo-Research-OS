# Alert Fatigue Control Intelligence

## 1. Overview
A Site Defense Engine that flags every typo with a flashing red light will be ignored by coordinators. "Alert Fatigue" is a massive operational risk. VIP has been hardened with a sophisticated Alert Triage and Routing matrix.

## 2. Hardened Logic
- **`ALERT_SEVERITY_ROUTING`:** Alerts are classified as INFO, LOW, MEDIUM, HIGH, CRITICAL, HARD_STOP. Only HIGH+ interrupt the workflow. The rest are batched.
- **`ALERT_THROTTLING`:** If a CRC dismisses a LOW risk alert (e.g., "Missing page number"), VIP suppresses identical alerts for X hours, shifting them to a passive digest.
- **`ALERT_SUPPRESSION_FOR_LOW_RISK_DUPLICATES`:** Repeated minor issues are converted into a silent "Trend Signal" rather than generating 50 separate popups.
- **`EXECUTIVE_ESCALATION_ONLY_FOR_HIGH_RISK`:** Protects the PI and Site Director from administrative noise. They only receive escalations for CRITICAL or HARD_STOP events (e.g., Eligibility failures).
- **`COORDINATOR_BURDEN_AWARE_ALERTING`:** VIP dynamically senses CRC task load. If a CRC is overwhelmed (>50 active tasks), VIP suppresses non-essential UI interruptions to prevent psychological burnout.

## 3. Site Defense Impact
Ensures that when VIP issues a CRITICAL alert or HARD_STOP, the coordinator pays immediate attention. It treats the coordinator's cognitive bandwidth as a finite, protected resource.
