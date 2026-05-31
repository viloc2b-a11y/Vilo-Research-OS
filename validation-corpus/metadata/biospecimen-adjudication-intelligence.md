# Biospecimen Adjudication Intelligence

## 1. Governance Matrix
To correct the engine's absolute bias, we introduce the **Adjudication Intelligence Matrix**. This dictates *who* has the legal and regulatory authority to make decisions regarding deviations.

### Decision Actors:
1. **SITE (PI/CRC):** Can act only within the strict boundaries of the Protocol and Lab Manual. Cannot override guidelines.
2. **CENTRAL LAB:** Can issue Queries (DCFs) and place samples on analytical hold. Cannot unilaterally destroy samples without Sponsor consent (unless biologically hazardous).
3. **MEDICAL MONITOR:** Adjudicates safety implications of recollecting samples.
4. **SPONSOR (QA/Clinical Operations):** Owns the data. Makes the final call on protocol deviation severity classification.
5. **STATISTICAL TEAM:** Decides if the data point is included in the *Per-Protocol (PP)* or *Intention-to-Treat (ITT)* population analysis.

## 2. Adjudication Scenarios

### Scenario A: Wrong Tube Used
- **Event:** Blood drawn in EDTA instead of Heparin.
- **Site Can Decide:** To document deviation, hold sample at correct temperature.
- **Must Escalate To:** Central Lab & Sponsor.
- **Required Documentation:** Deviation log, Central Lab Query.
- **Final Data Ownership:** Sponsor decides if sample is used for exploratory non-primary assays.

### Scenario B: Missing Timestamp
- **Event:** PK draw time not recorded.
- **Site Can Decide:** To attempt reconstruction using contemporaneous source (e.g., ECG machine timestamp performed simultaneously).
- **Must Escalate To:** CRA / Sponsor if unrecoverable.
- **Required Documentation:** Note to File (NTF) or Source Data Amendment.
- **Final Data Ownership:** Statistical Team decides if the PK point can be imputed or must be dropped.

### Scenario C: Temperature Excursion
- **Event:** Shipment arrives at Central Lab thawed.
- **Site Can Decide:** Nothing. (Event occurred in transit).
- **Must Escalate To:** Sponsor QA.
- **Required Documentation:** Courier temperature logs.
- **Final Data Ownership:** Central Lab rejects sample for analysis based on physical stability rules; Sponsor classifies deviation.
