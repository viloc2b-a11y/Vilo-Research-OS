# Monitoring Runtime Intelligence Report

## 1. Overview
The Monitoring Intelligence Engine abstracts how Clinical Research Associates (CRAs), Quality Assurance (QA) auditors, and Regulatory Agencies (FDA/EMA) evaluate site performance. It shifts Vilo OS from merely *collecting* data to understanding the *liability* of that data.

## 2. Core Monitoring Workflows

### 2.1 Source Data Verification (SDV) & Review (SDR)
- **SDV:** A mathematical comparison. Does the EDC value exactly match the EMR/Source value? Failure = Transcription Error (Query).
- **SDR:** A clinical and logical review. Does the narrative make medical sense? Are ALCOA+ principles upheld? Failure = Protocol Deviation or Fraud Risk.

### 2.2 Finding & Escalation Pathways
- **Minor Finding:** Transcription typo. *Resolution:* CRA issues EDC query. CRC corrects it.
- **Major Finding:** Missed PK window. *Resolution:* CRA logs Protocol Deviation. PI signs it. Sponsor evaluates data usability.
- **Critical Finding:** Subject dosed without ICF. *Resolution:* CRA escalates to CTM/Medical Monitor. Site placed on enrollment hold. IRB notified. CAPA initiated.

### 2.3 Site Risk Escalation
Modern monitoring is Risk-Based (RBM). Sites are evaluated on "Risk Signals".
- **Signals:** High query rates, slow query resolution (>30 days), high staff turnover, SAE reporting delays.
- **Consequence:** The site moves from remote monitoring (every 8 weeks) to targeted on-site monitoring (every 2 weeks), massively increasing administrative burden on the coordinators.

## 3. Corrective and Preventive Actions (CAPA)
A CAPA is not a punishment; it is a regulatory defense mechanism.
- **Trigger:** Systemic failure (e.g., 3 missed PK draws by the same nurse).
- **Design:** Root Cause Analysis (5 Whys) + Corrective Action (fix the current problem) + Preventive Action (change the SOP so it doesn't happen tomorrow).
- **Effectiveness:** If the error happens again in 90 days, the CAPA failed. The FDA will issue a Form 483 for failure to maintain adequate control.

## 4. The PI Oversight Mandate
The most critical failure point in an FDA audit is "Lack of PI Oversight". The FDA holds the PI strictly liable for all actions of the delegated staff. Unsigned lab reports, outdated DOA logs, and delegated tasks performed by un-delegated staff directly indict the PI.
