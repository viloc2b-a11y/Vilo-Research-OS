# Final Source Intelligence Validation Report
**Target Protocol:** `PROTOCOL_A004_AMEND_001` (Osteoarthritis Pain Study)

> **Objective:** Prove the engine knows what source documentation must exist, why it must exist, and what evidence proves each activity occurred.

---

## 1. Source Coverage Test
Design of the complete source package required for `PROTOCOL_A004`, evaluated for comprehensive coverage.

| Worksheet | Why It Exists | Protocol Evidence | Criticality | Deviation If Missing |
|-----------|---------------|-------------------|-------------|----------------------|
| **Screening Worksheet** | Captures baseline demographics, history, and initials of all required screening diagnostics. | SoA, Sec 4, Sec 5 | `CRITICAL_TO_ELIGIBILITY` | Major: Randomizing un-screened patient. |
| **Eligibility Checklist** | Master gate preventing ineligible subjects from randomization. | Sec 5.1, Sec 5.2 | `CRITICAL_TO_ELIGIBILITY` | Major: Protocol violation; potential safety harm. |
| **Randomization Worksheet (Visit 2)** | Confirms 14-day run-in compliance and captures baseline efficacy scoring just prior to IP. | SoA, Sec 4 | `CRITICAL_TO_ENDPOINT` | Major: Invalidates baseline for primary endpoint. |
| **Interim Visit Worksheets (3a-8a)** | Documents routine safety, vitals, AE/ConMed reviews. | SoA | `CRITICAL_TO_SAFETY` | Major: Missed toxicity or prohibited drug. |
| **Unscheduled Visit Worksheet** | Captures ad-hoc safety/efficacy if patient returns outside window for worsening OA or AEs. | Sec 8 | `CRITICAL_TO_SAFETY` | Major: Failure to monitor AE/deterioration. |
| **Early Termination (ET) / EOS Worksheet** | Closes out AEs, final imaging, and retrieves IP. | SoA, Sec 8.3 | `CRITICAL_TO_ENDPOINT` | Major: Loss of final safety/efficacy data. |
| **Master AE / SAE Log** | Long-term tracking of all adverse events and severity/relationship to IP. | Sec 8.3 | `CRITICAL_TO_SAFETY` | Major: Under-reporting safety signals to FDA/IRB. |
| **Master ConMed Log** | Tracks all drugs taken to ensure no prohibited IA steroids/NSAIDs are used. | Sec 5.2 | `CRITICAL_TO_COMPLIANCE` | Major: Drug-drug interaction or confounded efficacy. |
| **Pregnancy Tracking Log** | Ensures WOCBP are tested before every dose. | Sec 8.2 | `CRITICAL_TO_SAFETY` | Major: Fetotoxicity risk. |
| **Pain Diary Training & Compliance Log** | Documents that patient understands how to use the diary before baseline period. | Sec 4.1 | `CRITICAL_TO_ENDPOINT` | Major: Run-in data invalidated. |
| **Ophthalmology / OCT Tracking Log** | Tracks independent specialist appointments and ensures reports are filed to rule out macular edema. | Sec 8.2.4 | `CRITICAL_TO_SAFETY` | Major: Dosing patient with retinal risks. |
| **Imaging (X-ray/MRI) Tracking Log** | Ensures specific "Index Knee" is tracked and images uploaded to central reader. | Sec 8.3 | `CRITICAL_TO_ENDPOINT` | Minor/Major: Loss of secondary endpoint structural data. |
| **Abnormal ECG / QTcF Escalation Log** | Conditional log triggered if QTcF > 500ms to capture triplicate ECGs. | Sec 8.2.2 | `CRITICAL_TO_SAFETY` | Major: Missed cardiac toxicity signal. |
| **IP Accountability & Admin Log** | Proof of dose given, returned, and destroyed. | Pharmacy Manual, Sec 6 | `CRITICAL_TO_TREATMENT` | Major: Unknown exposure level. |
| **Protocol Deviation Log** | Tracks out-of-window visits or missed procedures. | GCP Standards | `CRITICAL_TO_COMPLIANCE` | Major: Site non-compliance finding during audit. |

---

## 2. Missing Worksheet Detection
Worksheets that are required but **NOT obvious** from the Schedule of Activities.

| Missing/Hidden Worksheet | Why It Is Required | Evidence Sections | Risk If Missing |
|--------------------------|--------------------|-------------------|-----------------|
| **Prior Treatment / SOC Washout Tracker** | Excludes patients who had IA steroids within 30 days. The SoA does not track "Washout". | Section 5.2 (Exclusion) | Randomizing a patient whose OA pain is temporarily masked by prior steroids. |
| **Contraception Counseling Log** | WOCBP must be counseled at *every* visit. Not listed in SoA as a standalone procedure row. | Section 5.1 (Inclusion) | Pregnancy occurs during trial; regulatory finding for lack of counseling. |
| **Triplicate ECG Escalation Form** | Only triggered if baseline ECG > 500ms. | Section 8.2.2 (Safety) | Cardiac event occurs; investigator cited for ignoring protocol-mandated safety cascade. |

---

## 3. Worksheet vs Section Decision
Determining the optimal structural vehicle for each source item.

| Source Item | Best Structure | Why | Risk If Wrong Structure |
|-------------|----------------|-----|-------------------------|
| **Vitals / Height / Weight** | Section inside Visit Worksheet | Linear, static data captured routinely. | Standalone worksheet creates excessive paperwork. |
| **Concomitant Medications** | Dedicated Log | ConMeds start and stop across multiple visits; must be viewed longitudinally. | If put inside a visit worksheet, it requires copying data repeatedly, risking transcription errors. |
| **Inclusion / Exclusion** | Standalone Worksheet | PI must sign off exactly once before Randomization. Master gate. | If buried inside a Visit 1 worksheet, the critical PI signature might be missed. |
| **ECG / OCT / MRI Reports** | Attachment / External Evidence | Machines/specialists generate validated 3rd-party reports. | Manual transcription of a 12-lead ECG risks ALCOA errors. Must attach original. |
| **Pain & Placebo Training** | Section inside Visit 1 Worksheet | It is a one-time event that must occur linearly before diary dispensing. | Standalone log might get detached from the Visit 1 sequence, causing sequence deviations. |

---

## 4. Source Evidence Test
What strictly proves completion under ALCOA+ principles.

| Worksheet | Evidence Required | Timestamp Required | Signature Required | Attachment Required | ALCOA Risk |
|-----------|-------------------|--------------------|--------------------|---------------------|------------|
| **Eligibility Checklist** | Checked YES/NO boxes | Yes (prior to Dose) | Yes (PI Signature) | No | PI signs *after* dose is given (Backdating). |
| **Visit Worksheet (Vitals)** | Values documented | Yes (HH:MM) | Yes (Coordinator) | No | Vitals taken post-dose instead of pre-dose. |
| **Imaging / OCT Tracker** | Confirmed "Index Knee" | Date of scan | Yes (PI Review) | Yes (Radiology/OCT Report) | Report not reviewed by PI for clinically significant findings. |
| **IP Accountability Log** | Vials dispensed/returned | Date | Yes (Pharmacy/CRC) | No | Unable to prove patient actually took the drug. |
| **Abnormal ECG Escalation** | 3 distinct QTcF values | Yes (Exactly 5 mins apart) | Yes (PI Review) | Yes (3 ECG Printouts) | Triplicates done 30 mins apart, violating protocol. |

---

## 5. Coordinator Attack Test

**A. Patient completed Screening. What source must now exist?**
- **Answer:** Signed Consent, Visit 1 Worksheet (vitals, training), X-ray order/report, OCT order/report, screening lab requisition, and Pain Diary Dispensing Log.
- **Required Source:** Master Screening Worksheet + Attachments.
- **Evidence Used:** Visit 1 SoA and Sequence logic.
- **Confidence:** HIGH
- **Deviation Risk:** Missing Pain Training invalidates run-in.

**B. Patient randomized. What documentation must the monitor expect?**
- **Answer:** The Master Eligibility Checklist SIGNED by the PI, 14-day diary calculation worksheet, negative pregnancy test, clean OCT report, and Visit 2 Randomization Worksheet.
- **Required Source:** Eligibility Checklist.
- **Evidence Used:** Sec 5 Inclusion/Exclusion.
- **Confidence:** HIGH
- **Deviation Risk:** Randomization without PI signature.

**C. OCT was ordered but report is not filed. What source is incomplete?**
- **Answer:** The Eligibility Checklist cannot be signed. The Screening phase is technically incomplete.
- **Required Source:** Ophthalmology Tracking Log / Attachments.
- **Evidence Used:** Sec 5.2 Exclusion Criteria.
- **Confidence:** HIGH
- **Deviation Risk:** Dosing a subject with hidden macular edema.

**D. Pain diary training was documented after diary issuance. Is this a deviation?**
- **Answer:** Yes. A Major Deviation. Training must precede issuance to protect baseline data integrity.
- **Required Source:** Visit 1 Worksheet (Timestamp comparison).
- **Evidence Used:** Sec 4.1 Study Flow.
- **Confidence:** HIGH
- **Deviation Risk:** Endpoint data invalidated.

**E. Pregnancy test expired before dosing. Can dosing proceed?**
- **Answer:** No. Dosing must halt until a new rapid/urine or serum test is conducted and verified negative.
- **Required Source:** Pregnancy Tracking Log.
- **Evidence Used:** Sec 8.2 Safety/Pregnancy rules.
- **Confidence:** HIGH
- **Deviation Risk:** Fetal exposure to IP.

**F. ECG QTcF is abnormal (>500ms). What source and follow-up documentation is required?**
- **Answer:** The Triplicate ECG Escalation Form must be completed, showing 3 repeat ECGs spaced exactly 5 minutes apart, attached to the original traces, and signed by the PI.
- **Required Source:** Abnormal ECG Log.
- **Evidence Used:** Sec 8.2.2.
- **Confidence:** HIGH
- **Deviation Risk:** Missed cardiac toxicity signal.

**G. Subject missed a diary day during run-in. Can randomization proceed?**
- **Answer:** No. The protocol strictly demands $\ge$ 14 days of compliance prior to randomization.
- **Required Source:** Run-In Verification Math Worksheet.
- **Evidence Used:** Sec 5.1 Inclusion.
- **Confidence:** HIGH
- **Deviation Risk:** Invalid primary endpoint baseline.

**H. IP was administered but accountability log is incomplete. What is the risk?**
- **Answer:** FDA/Regulatory violation for unproven drug exposure. The primary endpoint cannot be correlated to actual drug intake.
- **Required Source:** IP Accountability Log.
- **Evidence Used:** Sec 6 Study Intervention.
- **Confidence:** HIGH
- **Deviation Risk:** Severe GCP violation.

**I. Visit was completed outside window. What source must document this?**
- **Answer:** The Visit Worksheet must log the actual date, and a Protocol Deviation Log must be generated citing an out-of-window visit.
- **Required Source:** Protocol Deviation Log.
- **Evidence Used:** SoA Header Windows.
- **Confidence:** HIGH
- **Deviation Risk:** Unreported deviation.

**J. Subject withdraws early. What source documents are required?**
- **Answer:** Early Termination / End of Study Worksheet, final AE/ConMed checks, IP return accountability, final Imaging/OCT (if required), and Subject Withdrawal Log detailing the reason for withdrawal.
- **Required Source:** Early Termination Worksheet & Withdrawal Log.
- **Evidence Used:** Sec 8.3, SoA (Visit 9/ET).
- **Confidence:** HIGH
- **Deviation Risk:** Lost safety follow-up data.

---

## 6. Final Source Intelligence Readiness

| Intelligence Domain | Status |
|---------------------|--------|
| **Source Coverage Intelligence** | `READY` |
| **Missing Worksheet Detection** | `READY` |
| **Source Evidence Intelligence** | `READY` |
| **Coordinator Attack Handling** | `READY` |

### Final Decision:
**`SOURCE_BLUEPRINT_READY = TRUE`**

**Conclusion:**
The engine possesses complete command over the operational and regulatory documentation requirements for `PROTOCOL_A004`. It successfully mapped every procedure not just to a "form", but to the specific *evidence type*, *structural container* (Standalone vs. Log vs. Section), and *ALCOA requirement* necessary to survive an FDA audit. Source Blueprint generation is fully authorized.
