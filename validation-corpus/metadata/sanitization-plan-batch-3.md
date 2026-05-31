# Sanitization Plan - Batch 3

### Target Quotas
- PROTOCOLS: 3 (Remaining needed: 0)
- AMENDMENTS: 1 (Remaining needed: 0)
- ECRF_GUIDE: 1 (Remaining needed: 0)
- LAB/PHARMACY MANUAL: 1 (Remaining needed: 0)

### Selected Candidates
#### ECRF_GUIDE_A101 (ECRF_GUIDE)
- **Original Path:** `validation-corpus/inbox/MV40618_eCRF COMPLETION GUIDELINES_V 3.0.docx`
- **Risk Flags:** PROTOCOL_NUMBER
- **Status:** SANITIZATION_READY

#### AMENDMENT_A101 (AMENDMENT)
- **Original Path:** `validation-corpus/inbox/mRNA-1647-P301-protocol_amendment_7-final.pdf`
- **Risk Flags:** PROTOCOL_NUMBER
- **Status:** SANITIZATION_READY

#### PROTOCOL_A101 (PROTOCOL)
- **Original Path:** `validation-corpus/inbox/Protocolo Piloto Ozono + Nad Capilar (v1.docx`
- **Risk Flags:** NONE
- **Status:** SANITIZATION_READY

#### LAB_MANUAL_A101 (LAB_MANUAL)
- **Original Path:** `validation-corpus/inbox/UDX CRF 3 Blood Collection Ver 27JAN21.pdf`
- **Risk Flags:** PROTOCOL_NUMBER
- **Status:** SANITIZATION_READY

#### PROTOCOL_A102 (PROTOCOL)
- **Original Path:** `validation-corpus/inbox/12. Protocol and Protocol Amendments/12. Protocol and Protocol Amendments/Protocol Amendments/LIN-MD-64 Study Synopsis 17APR2019.pdf`
- **Risk Flags:** PROTOCOL_NUMBER
- **Status:** SANITIZATION_READY

#### PROTOCOL_A103 (PROTOCOL)
- **Original Path:** `validation-corpus/inbox/AA Toolbox 1573/AA Toolbox 1573/1573_Clinical Protocol_Ver 1.0_Final_20241018.pdf`
- **Risk Flags:** NONE
- **Status:** SANITIZATION_READY

### Replacement Candidates (Backups)
#### BACKUP (ECRF_GUIDE)
- **Original Path:** `validation-corpus/inbox/MV40618_eCRF Completion Guidelines_9.0_16Jun2022.pdf`
- **Risk Flags:** PROTOCOL_NUMBER

#### BACKUP (AMENDMENT)
- **Original Path:** `validation-corpus/inbox/Budgets/Pharma/Abbvie 533 Amendment 8/M14-533 protocol amendment 8.pdf`
- **Risk Flags:** SPONSOR_NAME|PROTOCOL_NUMBER

#### BACKUP (LAB_MANUAL)
- **Original Path:** `validation-corpus/inbox/UDX CRF 4 Plasma Prep Ver 27JAN21.pdf`
- **Risk Flags:** PROTOCOL_NUMBER

#### BACKUP (PROTOCOL)
- **Original Path:** `validation-corpus/inbox/Budgets/Biospecimen/Toolbox 1498 COVID Apr 2023/1498_Clinical Protocol_V1.0_Final_20230412.pdf`
- **Risk Flags:** NONE

### Manual Review Notes
- The selection engine actively filtered out any paths containing `Pt Specific` directories.
- Fallbacks to the Master Inventory were used if the V3 Gold Standard pool was exhausted for a specific class without triggering PHI warnings.
