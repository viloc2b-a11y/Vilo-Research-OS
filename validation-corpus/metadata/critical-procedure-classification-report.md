# Critical Procedure Classification Report

## Context
This report demonstrates the new Protocol Intelligence Rule: defining the "Why" and "What If" for every extracted procedure rather than treating them as equal tabular strings. Procedures extracted from the SoA are mapped against the unified protocol knowledge model to assign operational severity.

## Categorization Schema
The engine now tags every procedure with one or more operational severities:
- `CRITICAL_TO_ELIGIBILITY`: Results determine if a subject can be randomized.
- `CRITICAL_TO_SAFETY`: Monitors subject well-being or drug toxicity.
- `CRITICAL_TO_ENDPOINT`: Direct data point for primary/secondary efficacy endpoints.
- `CRITICAL_TO_TREATMENT`: Essential for drug administration or dosing calculation.
- `CRITICAL_TO_COMPLIANCE`: Assesses patient adherence to protocol rules.
- `ROUTINE`: Standard operational data collection without direct critical implications.

---

## Applied Classification Example (Based on PROTOCOL_A004)

### 1. Ophthalmology examination: fundoscopic retinal exam and OCT
- **Classification:** `CRITICAL_TO_SAFETY`, `CRITICAL_TO_ELIGIBILITY`
- **Rationale:** The protocol excludes subjects with specific pre-existing retinal conditions. Performing this exam at Screening determines eligibility. Monitoring it longitudinally ensures the study drug is not causing emergent ocular toxicity.
- **Source Impact:** Must be prominently flagged on the Screening Worksheet as a Hard Stop before Randomization.

### 2. Serum Pregnancy Test (WOCBP only)
- **Classification:** `CRITICAL_TO_SAFETY`, `CRITICAL_TO_ELIGIBILITY`
- **Rationale:** Excludes pregnant women from the trial. A positive test during the trial triggers immediate treatment discontinuation.
- **Source Impact:** Required on all female screening worksheets; explicitly tied to the safety/withdrawal workflow.

### 3. Daily ADP NRS 0-10 pain score at least 14 days prior to randomisation
- **Classification:** `CRITICAL_TO_ENDPOINT`, `CRITICAL_TO_ELIGIBILITY`, `CRITICAL_TO_COMPLIANCE`
- **Rationale:** This is the primary efficacy endpoint mechanism. Furthermore, failure to comply for $\ge$ 14 days invalidates the run-in phase, making the subject ineligible for Randomization.
- **Source Impact:** Must trigger a compliance calculation worksheet at Visit 2.

### 4. X-ray index knees
- **Classification:** `CRITICAL_TO_ENDPOINT`, `CRITICAL_TO_ELIGIBILITY`
- **Rationale:** Determines baseline OA severity (eligibility) and provides structural data for longitudinal efficacy analysis (endpoint). 
- **Source Impact:** Must specify "Index Knees" clearly to prevent deviations of imaging the wrong joint.

### 5. Height
- **Classification:** `ROUTINE`
- **Rationale:** Required for demographic baseline and potential BMI calculation, but missing it rarely triggers immediate safety or primary endpoint failures.
- **Source Impact:** Documented on standard baseline vitals worksheet.

### 6. Review concomitant medications
- **Classification:** `CRITICAL_TO_SAFETY`, `CRITICAL_TO_COMPLIANCE`
- **Rationale:** Certain medications are prohibited and will cause a protocol deviation or safety interaction with the study drug.
- **Source Impact:** Must be reviewed at every visit.

## Operational Summary
By classifying procedures with these operational tags, the Vilo OS Source Generation engine can dynamically build worksheets that emphasize *Hard Stops* and safety-critical tasks, drastically reducing the cognitive load and protocol deviation risk for Clinical Research Coordinators.
