# Query Intelligence Report

## 1. Overview
Queries are the primary mechanism of clinical data cleaning. VIP categorizes queries to prioritize coordinator attention and assess site risk.

## 2. Query Classification Matrix

### A. Administrative / Documentation Query
- **Examples:** Typo in visit date, missing page number.
- **Severity:** Low.
- **Aging Risk:** Delays SDV completion, annoys data management.
- **Financial Impact:** Zero to Low.

### B. Eligibility Query
- **Examples:** Inclusion criteria #4 not checked; screening lab out of range.
- **Severity:** CRITICAL.
- **Aging Risk:** Patient is receiving IP illegally if ineligible.
- **Financial Impact:** Sponsor may refuse to pay for the entire subject's data.

### C. Safety Query
- **Examples:** AE stop date missing; ConMed indication does not match any AE.
- **Severity:** HIGH.
- **Aging Risk:** Missed safety signals threaten the entire clinical program. Triggers Medical Monitor escalation within 48h.
- **Financial Impact:** Moderate to High.

### D. Protocol / Endpoint Query
- **Examples:** Missed primary efficacy scan; vital signs outside of 15-minute window.
- **Severity:** MAJOR.
- **Aging Risk:** Data becomes un-analyzable for the SAP.
- **Financial Impact:** Visit payment withheld until resolved or marked as protocol deviation.

### E. Drug Accountability Query
- **Examples:** 30 pills dispensed, 20 returned, subject reports taking 8. (2 pills missing).
- **Severity:** HIGH.
- **Aging Risk:** Investigational Product is heavily regulated. Unaccounted IP is an FDA red flag.
- **Financial Impact:** High.

## 3. The Query Escalation Path
1. **0-14 Days:** Routine data cleaning.
2. **15-30 Days:** Aging Query. CRA emails the Coordinator.
3. **31-45 Days:** Escalate to PI. Site metrics flag turns yellow.
4. **>45 Days:** Site placed on Corrective Action. Payments withheld. Sponsor CTM contacts PI directly.
