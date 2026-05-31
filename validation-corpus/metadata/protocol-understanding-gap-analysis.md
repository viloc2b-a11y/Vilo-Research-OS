# Protocol Understanding Gap Analysis

## Overview
A critical operational blind spot was identified during the initial Protocol Understanding demonstration. The system correctly extracted the ophthalmology procedures (e.g., OCT, CFP) from the parsed SoA matrix (`PROTOCOL_A004_AMEND_001.parser-result.json`) but initially failed to surface them as critical operational requirements during a summary because it lacked holistic semantic context outside the table boundaries.

## Root Cause Analysis
The system was acting as a **Table Parser** rather than a **Protocol Understanding Engine**. 
1. **Isolated Matrix Evaluation:** The parser extracted the SoA grid perfectly, but evaluated "importance" based strictly on procedure frequency and table position, ignoring the rich clinical context embedded in the Inclusion/Exclusion and Safety sections.
2. **Missing Semantic Linkages:** A procedure like "Fundoscopic Retinal Exam" in the SoA cannot be properly classified without linking it to the protocol body text (e.g., "Retinal exam is required to rule out pre-existing macular edema before randomization"). 
3. **Absence of Severity Classifications:** The parser outputs structural schemas (`Protocol_Procedure_Definition`), but lacks an ontological layer to flag procedures as `CRITICAL_TO_SAFETY` or `CRITICAL_TO_ELIGIBILITY`.

## Recognized Operational Gaps

### 1. Footnote vs. Protocol Body Divergence
- **Gap:** Footnotes often contain condensed logic (e.g., "if clinically indicated"). If the system does not cross-reference the `Procedure Descriptions` section in the protocol body, the definition of "clinically indicated" is lost, leaving the coordinator to guess the actual clinical trigger.

### 2. Eligibility Cross-References
- **Gap:** The SoA lists "Inclusion/Exclusion criteria." The system cannot answer coordinator questions about *what* makes a patient eligible if it does not index the actual Section 4/5 Eligibility criteria alongside the SoA. (e.g., failing to realize an OCT finding makes a patient ineligible).

### 3. Safety Escalation Triggers
- **Gap:** PRN or conditional procedures (like an unscheduled MRI or repeat ECG) are flagged as conditional `(X)` in the SoA, but the actual escalation threshold (e.g., "if QTcF > 500 ms") lives in the Safety/Toxicity management sections.

### 4. Amendment Contradictions
- **Gap:** Without synthesizing the `Summary of Changes` section of an amendment against the new SoA, the system risks carrying forward outdated coordinator knowledge regarding window changes or newly mandated tests.

## Conclusion
True protocol intelligence cannot be achieved by exclusively reading grids. A multi-document semantic knowledge graph must be constructed that unifies tabular extractions with the clinical rationale found in the narrative body of the protocol.
