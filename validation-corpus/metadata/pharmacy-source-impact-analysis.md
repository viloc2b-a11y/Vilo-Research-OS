# Pharmacy Source Impact Analysis

## 1. Overview
The extraction of Pharmacy Runtime Intelligence directly impacts the architecture of Vilo OS's Source Blueprints. This analysis maps the newly acquired VIP Pharmacy Patterns to the physical eSource worksheets and logs that must be automatically generated to support these back-office operations.

## 2. Recommended Source Modules

The following logs must be structurally defined in the system based on the abstracted pharmacy rules:

| Required Source Module | Justification | Classification |
|------------------------|---------------|----------------|
| **IP Receipt & Shipment Log** | `VIP_PAT_PHARM_003`. Must verify physical integrity, logger readout, and transit time prior to placing in active inventory. | UNIVERSAL |
| **Daily Temperature Log (Min/Max)** | `VIP_PAT_PHARM_012`. Even with digital continuous logging, manual backup min/max verification is a universal regulatory requirement. | UNIVERSAL |
| **Temperature Excursion & Quarantine Log** | `VIP_PAT_PHARM_001` & `VIP_PAT_PHARM_002`. Out-of-range IP must be immediately quarantined and cannot be dispensed without Sponsor sign-off. | UNIVERSAL |
| **Master IP Accountability Log** | `VIP_PAT_PHARM_004`. Requires the mathematical reconciliation of: Received = Dispensed + On-Hand + Destroyed + Lost. | UNIVERSAL |
| **Subject Level Dispensing Log** | `VIP_PAT_PHARM_005`. Verifies that IRT vial assignment matches the physical bottle handed to the specific subject. | UNIVERSAL |
| **Subject Level IP Return Log** | `VIP_PAT_PHARM_007`. Crucial for self-administered outpatient trials. Tracks exactly how many pills the patient took vs returned. | STUDY_DEPENDENT (Outpatient only) |
| **IP Destruction Log** | `VIP_PAT_PHARM_008`. Captures sponsor permission and actual physical destruction witnesses. | STUDY_DEPENDENT (If local destruction allowed) |

## 3. Structural Constraints (Hard Stops) Applied to Source
1. **Quarantine Block:** If a vial is entered onto the *Temperature Excursion Log*, the *Subject Level Dispensing Log* MUST prevent that vial from being selected via an active Hard Stop.
2. **IRT Reconcile Block:** The system MUST NOT allow the *Subject Level Dispensing Log* to be signed off if the entered vial number mismatches the IRT assignment payload.
