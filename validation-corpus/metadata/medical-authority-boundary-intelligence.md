# Medical Authority Boundary Intelligence

## 1. Overview
Artificial Intelligence cannot practice medicine. The FDA holds the Principal Investigator (PI) solely responsible for clinical medical judgments. VIP has been hardened to aggressively enforce its own boundary: it is an operational engine, not a physician.

## 2. Hardened Logic
- **`MEDICAL_OVERRIDE_AUTHORITY`:** VIP will flag abnormal values based on math, but strictly defer to the PI's clinical judgment. (e.g., `{ai_adjudication_allowed: false, medical_authority: "PI"}`).
- **`PI_CS_NCS_ADJUDICATION`:** VIP will emit a `HARD_STOP` preventing the finalization of a safety visit until the PI explicitly marks an abnormal value as Clinically Significant (CS) or Not Clinically Significant (NCS). 
- **`ABNORMAL_RESULT_REVIEW_REQUIRED`:** VIP detects "passive" PI behavior (e.g., batch-signing 50 labs without looking) by forcing individual review tasks for any flagged abnormal result.
- **`MEDICAL_JUDGMENT_BOUNDARY`:** When asked a question like "Is this headache related to the study drug?", VIP explicitly outputs its inability to answer, routing the query immediately to the Medical Monitor.

## 3. Site Defense Impact
Protects the Principal Investigator from FDA 483 citations for "Lack of Oversight." By forcing the PI to explicitly adjudicate CS/NCS on flagged values, VIP ensures the site's medical narrative is legally defensible.
