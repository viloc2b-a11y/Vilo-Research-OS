# VILO OS — STUDY RUNTIME CANONICALIZATION + STUDY SETUP WIZARD

## FINAL QUESTION

**Can the current architecture support a complete Study Runtime and Study Setup Wizard using shared site master files plus study-specific ISF documents without creating duplicate document repositories?**

**YES.**
The `compliance_runtime_documents` and `attachments` schemas both support `study_id = NULL` while strictly enforcing `organization_id`. This allows documents (Trainings, Credentials, SOPs) to live at the Site Master File level and be queried or referenced natively by any study within that organization without duplication.

### Remaining P0 Blockers
1. **Team Assignment & Delegation Log:** RBAC persists (`study_members`), but there is no UI to configure the study team, unblinded roles, or generate a formal Delegation Log.
2. **Enrollment Configuration:** Rules, Subject Numbering schemes, and Randomization blocks lack persistence models and configuration UI.
3. **Activation Readiness Gates:** No mechanism to evaluate if the required ISF documents and blueprints are present before allowing the study `status` to toggle to `active`.

---

## REQUIRED AUDIT

### Study Runtime Structure Matrix

#### Operational Layer
| Section | Exists? | UI Exists? | Persistence Exists? | Needs Wizard Configuration? | Needs Activation Validation? | P0? |
|---|---|---|---|---|---|---|
| Overview | Yes | Yes | Yes (`studies`) | Yes | No | No |
| Subjects | Yes | Yes | Yes (`study_subjects`) | No | Yes | No |
| Enrollment (Rules) | No | No | No | Yes | Yes | Yes |
| Visits | Yes | Yes | Yes | No | Yes | No |
| Study Team | Partial | No | Yes (`study_members`) | Yes | Yes | Yes |
| Contacts | No | No | No | Yes | No | No |
| Key Dates | No | No | No | Yes | No | No |
| Notes | No | No | No | No | No | No |

#### Regulatory Layer
| Section | Exists? | UI Exists? | Persistence Exists? | Needs Wizard Configuration? | Needs Activation Validation? | P0? |
|---|---|---|---|---|---|---|
| eDocs-Regulatory | Yes | Yes | Yes | Yes | Yes | No |
| Training Log | Partial | No | Partial (Docs) | Yes | Yes | No |
| Delegation Log | Partial | No | Partial (RBAC) | Yes | Yes | Yes |
| Unblinded Team | Yes | No | Yes (`roles`) | Yes | Yes | No |
| Audit Trail | Yes | Partial | Yes (`ledger`) | No | No | No |

---

### Shared Document Reuse Audit

**Can Trainings, Credentials, Site Credentials, and Site Operations be referenced into studies instead of duplicated?**
**YES.**

---

### Activation Readiness Matrix

| Component | Exists? | UI? | Missing? | P0? |
|---|---|---|---|---|
| Study Record | Yes | Yes | No | No |
| Protocol | Yes | Yes | No | No |
| Source Package | Yes | Yes | No | No |
| Visit Structure | Yes | Yes | No | No |
| Procedure Structure | Yes | Yes | No | No |
| Team Assignment | Yes | No | Yes | Yes |
| Delegation Log | Partial | No | Yes | Yes |
| Required Regulatory Docs | Yes | Yes | No | No |
| Enrollment Rules | No | No | Yes | Yes |
| Subject Numbering | No | No | Yes | Yes |
| Randomization Rules | No | No | Yes | Yes |

---

### Study Setup Wizard Specification

*Based on actual gaps and required configuration flow:*

1. **Study Information** *(Configures Overview, Dates, Sponsor)*
2. **Team Assignment & Delegation** *(Fills Team Assignment and Delegation Log P0 gaps)*
3. **Document Intake** *(Existing: Upload Protocol, ISF, refer Site Master Files)*
4. **Source Generation** *(Existing: Draft visits/procedures)*
5. **Visit & Source Review** *(Existing: Publish source package)*
6. **Enrollment Configuration** *(Fills Enrollment Rules, Subject Numbering, Randomization P0 gaps)*
7. **Activation & Readiness** *(Evaluates required docs, team, and source -> toggles to Active)*
