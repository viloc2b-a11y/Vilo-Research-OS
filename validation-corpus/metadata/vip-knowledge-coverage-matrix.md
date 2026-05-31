# VIP Knowledge Coverage Matrix

## 1. Overview
This matrix maps the current state of Vilo Intelligence Platform (VIP) governed memory across all major clinical trial operational domains. It assigns a coverage score based on the depth and breadth of the 22 abstracted patterns currently residing in `protocol-intelligence-patterns.candidate.json`.

**Scoring Key:**
- **HIGH:** Multiple robust patterns abstracted from real protocols; direct implementation in Source Blueprints.
- **MEDIUM:** Initial patterns abstracted, but reliant on a single protocol or narrow use case.
- **LOW:** Mentioned in challenges or workflows, but no formal VIP pattern/Hard Stop generated.
- **NONE:** Complete blind spot. No intelligence extracted for this domain.

---

## 2. Coverage Matrix

### 2.1 Patient Operations
| Domain | Score | Supporting Protocols | Supporting VIP Patterns / Evidence |
|--------|-------|----------------------|------------------------------------|
| **Eligibility** | HIGH | A004 | `VIP_PAT_1701364200001` (PI Signature prior to IRT). |
| **Screening** | HIGH | A004, A011 | `VIP_PAT_A011_001` (<48h acute onset windows). |
| **Randomization** | HIGH | A004 | Hard Stops block Randomization without OCT/14-day Diary. |
| **Visit Execution** | HIGH | A004, A011 | Visit Sequence rules and Telehealth Remote Verification rules. |
| **Safety Monitoring** | HIGH | A004 | `VIP_PAT_1701364200003` (Triplicate ECG cascade logic). |
| **AE Management** | MEDIUM | A004 | AE Log Source Drafts exist, but complex causality logic is thin. |
| **SAE Management** | LOW | A004 | Extracted during Challenge Mode, but no strict VIP pattern. |
| **ConMeds** | MEDIUM | A004 | ConMed Washouts modeled, but prohibited concurrent meds lack rules. |
| **Pregnancy** | HIGH | A004 | `VIP_PAT_1701364200005` (Strict negative test prior to dosing WOCBP). |
| **Endpoint Collection**| HIGH | A004, A011 | Run-in math verification, Categorical symptom diaries, Temp diaries. |

### 2.2 Pharmacy Operations
| Domain | Score | Supporting Protocols | Supporting VIP Patterns / Evidence |
|--------|-------|----------------------|------------------------------------|
| **Drug Receipt** | NONE | N/A | No patterns abstracted. |
| **Drug Storage** | NONE | N/A | No patterns abstracted. |
| **Temperature Monitoring** | NONE | N/A | No patterns abstracted. |
| **Temperature Excursions** | NONE | N/A | No patterns abstracted. |
| **Accountability** | MEDIUM| A004 | `VIP_PAT_1701364200006` (IP Accountability Log requirement). |
| **Dispensing** | MEDIUM| A004 | PI Eligibility signature required prior to dispensing. |
| **Returns / Destruction** | NONE | N/A | No patterns abstracted. |
| **Unblinded Workflow** | NONE | N/A | Unblinded Pharmacy Manual exists in corpus but is un-mined. |

### 2.3 Biospecimen Operations
| Domain | Score | Supporting Protocols | Supporting VIP Patterns / Evidence |
|--------|-------|----------------------|------------------------------------|
| **Collection** | HIGH | A011 | `VIP_PAT_A011_005` (Anatomical site + Timestamp verification). |
| **Processing** | LOW | A011 | Implied in local vs central testing rule. |
| **Centrifugation** | NONE | N/A | No RPM/Time/Temp rules abstracted. |
| **Aliquoting** | NONE | N/A | No patterns abstracted. |
| **Storage** | LOW | A011 | Swab temperature logs mentioned, but freezer rules missing. |
| **Chain of Custody** | MEDIUM| A011 | `VIP_PAT_A011_015` (Courier waybills + Temp verification). |
| **Shipping** | MEDIUM| A011 | Central lab logistics pattern. |
| **Lab Reconciliation** | NONE | N/A | No rules comparing central vs local lab results. |

### 2.4 Site Operations
| Domain | Score | Supporting Protocols | Supporting VIP Patterns / Evidence |
|--------|-------|----------------------|------------------------------------|
| **Monitoring Readiness** | LOW | A004 | Read-only mode exists in app, but no VIP intelligence rules. |
| **Query Management** | NONE | N/A | No abstraction of query resolution rules. |
| **Source-to-CRF** | LOW | A004, A011 | Blueprint schemas exist, but transcription reconciliation rules do not. |
| **Missing Data Prev.** | HIGH | A004, A011 | Blueprint Hard Stops and required field architectures directly prevent this. |
| **Audit Readiness** | HIGH | A004 | ALCOA+ `evidence_required` patterns explicitly mapped. |
| **Regulatory Docs** | NONE | N/A | IRB/DOA/1572 documentation abstraction is completely absent. |

### 2.5 Protocol Operations
| Domain | Score | Supporting Protocols | Supporting VIP Patterns / Evidence |
|--------|-------|----------------------|------------------------------------|
| **Amendments** | MEDIUM| A004 | `VIP_PAT_1701364200007` (Blueprint updates on new condition). |
| **Conditional Logic** | HIGH | A004, A011 | "If A then B" effectively mapped (Triplicate ECGs, SARS-CoV-2 positive). |
| **Hard Stops** | HIGH | A004, A011 | Eligibility blockers, <48h window limits mathematically modeled. |
| **Visit Windows** | MEDIUM| A004 | Extracted during Operational Intelligence but not robustly converted to VIP rules. |
| **Sequence Dep.** | HIGH | A004 | Consent -> Eligibility -> Randomization -> Dosing strictly modeled. |
