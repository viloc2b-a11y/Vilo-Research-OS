# Validation Corpus Discovery Report

## 1. Corpus Statistics
- **Total files:** 131
- **Total Protocols:** 10
- **Total Amendments:** 9
- **Total eCRF Guidelines:** 39
- **Total Source Guides:** 0
- **Total Manuals:** 3
- **Total Budgets:** 5
- **Total CTAs:** 7
- **Total Regulatory Documents:** 15
- **Total Archives (.zip):** 17
- **Total Unknowns:** 26

## 2. Gold Standard Candidate List
Top 10 documents most valuable for Reader validation based on size, classification, and inferred structural complexity.

- **VALIDATION_PROTOCOL_001 US Protocol v4.0 (Amendment 3) with ICF v6.0 Notification and Documents (1).zip** (High Complexity) - 4560 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **VALIDATION_PROTOCOL_001 US Protocol v4.0 (Amendment 3) with ICF v6.0 Notification and Documents.zip** (High Complexity) - 4560 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **Coologics_Protocol for IRB_FInal060624_Update25AUG25_IRB Approved.docx-2.pdf** (High Complexity) - 2910 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **Coologics_Protocol for IRB_FInal060624_Update042825_Clean.docx.pdf** (High Complexity) - 2896 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **Coologics_Protocol+for+IRB_FInal060624_Update042825_Clean.docx.pdf** (High Complexity) - 2896 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **12. Protocol and Protocol Amendments.zip** (High Complexity) - 2280 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **2.1 VALIDATION_PROTOCOL_001 Protocol Amendment 2 V3.0 23Sep2025.pdf** (High Complexity) - 2065 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **2.1_VALIDATION_PROTOCOL_001 Protocol Amendment 2 V3.0 PRT-0000074.pdf** (High Complexity) - 2065 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **Protocol Amendment 2, Version 3.0 Signature Page.pdf** (High Complexity) - 2065 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes
- **2.1 VALIDATION_PROTOCOL_001-protocol-amend-1-v2-20250409_signed_no cert_09Apr25.pdf** (High Complexity) - 2045 KB
  - *Expected Features:* SoA, visit windows, procedures, conditional logic, footnotes

## 3. Reader Validation Coverage Analysis
The corpus exhibits excellent coverage across multiple domains. We have identified 10 base protocols and 9 amendments, offering robust testing for protocol logic parsing, amendment delta tracking, and SoA extraction.
The inclusion of 39 eCRF guidelines and 0 source worksheets provides strong opportunities to validate field-level cross-references and form linkage mapping.

## 4. Recommended Sanitization Queue
These files should be prioritized for sanitization into `validation-corpus/sanitized/protocols/`:
1. `VALIDATION_PROTOCOL_001 US Protocol v4.0 (Amendment 3) with ICF v6.0 Notification and Documents (1).zip`
1. `VALIDATION_PROTOCOL_001 US Protocol v4.0 (Amendment 3) with ICF v6.0 Notification and Documents.zip`
1. `Coologics_Protocol for IRB_FInal060624_Update25AUG25_IRB Approved.docx-2.pdf`
1. `Coologics_Protocol for IRB_FInal060624_Update042825_Clean.docx.pdf`
1. `Coologics_Protocol+for+IRB_FInal060624_Update042825_Clean.docx.pdf`

## 5. Corpus Inventory & Complexity Ranking
| File Name | File Type | Ext | Size (KB) | Complexity |
|-----------|-----------|-----|-----------|------------|
| VALIDATION_PROTOCOL_001 US Protocol v4.0 (Amendment 3) with ICF v6.0 Notification and Documents (1).zip | Amendment | .zip | 4560 | High |
| VALIDATION_PROTOCOL_001 US Protocol v4.0 (Amendment 3) with ICF v6.0 Notification and Documents.zip | Amendment | .zip | 4560 | High |
| 12. Protocol and Protocol Amendments.zip | Amendment | .zip | 2280 | High |
| 2.1 VALIDATION_PROTOCOL_001 Protocol Amendment 2 V3.0 23Sep2025.pdf | Amendment | .pdf | 2065 | High |
| 2.1_VALIDATION_PROTOCOL_001 Protocol Amendment 2 V3.0 PRT-0000074.pdf | Amendment | .pdf | 2065 | High |
| Protocol Amendment 2, Version 3.0 Signature Page.pdf | Amendment | .pdf | 2065 | High |
| 2.1 VALIDATION_PROTOCOL_001-protocol-amend-1-v2-20250409_signed_no cert_09Apr25.pdf | Amendment | .pdf | 2045 | High |
| 2.1 VALIDATION_PROTOCOL_001_Protocol amend 1_v2_09APR2025.pdf | Amendment | .pdf | 2045 | High |
| mRNA-1647-P301-protocol_amendment_7-final.pdf | Amendment | .pdf | 1504 | Medium |
| Acasti.zip | Archive | .zip | 697747 | Low |
| Allergan.zip | Archive | .zip | 337644 | Low |
| AA Boca Bio CRSPTL 00061.zip | Archive | .zip | 123350 | Low |
| Abbott.zip | Archive | .zip | 51204 | Low |
| AA Clinica Gen Bio (Missy).zip | Archive | .zip | 30922 | Low |
| OneDrive_1_12-15-2025.zip | Archive | .zip | 29290 | Low |
| OneDrive_2026-01-23.zip | Archive | .zip | 26807 | Low |
| EOS Download Media - mRNA-1647-P301 - US060-Vilo Research Group, L.L.C - Mar 10, 2026 02 05 58 831 PM GMT+0000.zip | Archive | .zip | 24884 | Low |
| RE_ Boca Bio- Execution Plan and Enrollment Structure � CRSPTL-00061 Wave II.zip | Archive | .zip | 1765 | Low |
| AA Toolbox 1573.zip | Archive | .zip | 1026 | Low |
| MDC_ New Strep A Study Qualification.zip | Archive | .zip | 1008 | Low |
| IPP (1).zip | Archive | .zip | 991 | Low |
| IPP.zip | Archive | .zip | 991 | Low |
| 14. Safety and Reporting.zip | Archive | .zip | 830 | Low |
| AbbVie Covid Study.zip | Archive | .zip | 274 | Low |
| CRM para Estudios Cl�nicos en Estados Unidos.zip | Archive | .zip | 230 | Low |
| AbbVie IBD Studies.zip | Archive | .zip | 143 | Low |
| Budgets.zip | Budget | .zip | 238307 | Low |
| SMO Payment Agreement_Gilead GS-US-685-6819_Zepeda_FINAL_RV1_FE.pdf | Budget | .pdf | 613 | Low |
| 2018-08 Site Budget 24ul2019 for MSA - 183 Ojeas.pdf | Budget | .pdf | 212 | Low |
| Payment Details Report_mRNA-1647-P301 United States US060 Zepeda_11May2026.xlsx | Budget | .xlsx | 99 | Low |
| Protocol-Based_Budget_Justification_Vilo.pdf | Budget | .pdf | 2 | Low |
| Vilo_Master Clinical Study Agreement_31Oct2025_final.pdf | CTA | .pdf | 516 | Low |
| Vilo_Master Clinical Study Agreement and SOW Template 25JUL2025 24OCT2025 31OCT2025.docx | CTA | .docx | 175 | Low |
| Vilo_Master Clinical Study Agreement and SOW Template 25JUL2025 20OCT2025.docx | CTA | .docx | 174 | Low |
| Vilo_Master Clinical Study Agreement and SOW Template 25JUL2025 20OCT2025 (1).docx | CTA | .docx | 172 | Low |
| Master Clinical Study Agreement and SOW Template 25JUL2025 (1).docx | CTA | .docx | 166 | Low |
| Master Clinical Study Agreement and SOW Template 25JUL2025 (2).docx | CTA | .docx | 166 | Low |
| Master Clinical Study Agreement and SOW Template 25JUL2025.docx | CTA | .docx | 166 | Low |
| RE_ Boca Bio  Continued Collaboration � HBV Budget agreed.zip | Lab Manual | .zip | 972 | Low |
| VRG_SOP_Bethesda_Specimen_Adequacy.pdf | Lab Manual | .pdf | 4 | Low |
| VALIDATION_PROTOCOL_001_Participant Journey Worksheet_PV 1.0_Screening and First Dose Visit_24Sep2025 (1).pdf | Pharmacy Manual | .pdf | 555 | Low |
| Coologics_Protocol for IRB_FInal060624_Update25AUG25_IRB Approved.docx-2.pdf | Protocol | .pdf | 2910 | High |
| Coologics_Protocol for IRB_FInal060624_Update042825_Clean.docx.pdf | Protocol | .pdf | 2896 | High |
| Coologics_Protocol+for+IRB_FInal060624_Update042825_Clean.docx.pdf | Protocol | .pdf | 2896 | High |
| RFP_DUB-001 version 0.2x_Clinical Study Protocol Synopsis Phase I and 2a_CLEAN (2).pdf | Protocol | .pdf | 1295 | Medium |
| Re_ MT Group Continuing Review for Protocol MTG-022.zip | Protocol | .zip | 1136 | Medium |
| Ingenuity Dual protocol 09Sep25 vus1.0final-signed.pdf | Protocol | .pdf | 1025 | Medium |
| CGB001 Protocol_05May2025.pdf | Protocol | .pdf | 755 | Medium |
| DCN- Clinical Protocol Start Up.zip | Protocol | .zip | 431 | Medium |
| APP030 Protocol Guidelines - Version 1.3.pdf | Protocol | .pdf | 77 | Medium |
| Protocolo Piloto Ozono + Nad Capilar (v1.docx | Protocol | .docx | 16 | Medium |
| SIV All Studies Training Material Site # 9545.zip | Regulatory Document | .zip | 105628 | Low |
| VALIDATION_PROTOCOL_001 - Site 030_ViloResearch - First Screenings.zip | Regulatory Document | .zip | 11108 | Low |
| 2.7 VALIDATION_PROTOCOL_001_Site Initiation Visit Slide Deck_V4_24Sep25.pdf | Regulatory Document | .pdf | 7101 | Low |
| CRSPTL-00101_SIV_VRG_22Jan26.pdf | Regulatory Document | .pdf | 2118 | Low |
| Blank Essential documents.zip | Regulatory Document | .zip | 1953 | Low |
| IMVT-1401-3201,_3202,_and_3203_Site_Reference_Manual_V1_30Jan2023_Final.docx.pdf | Regulatory Document | .pdf | 1762 | Low |
| LIN-MD-64 SAE Form.doc | Regulatory Document | .doc | 379 | Low |
| SAE checklist.pdf | Regulatory Document | .pdf | 362 | Low |
| VALIDATION_PROTOCOL_001_030_SIV_Report_Boynton_29JUL2025.pdf | Regulatory Document | .pdf | 288 | Low |
| 9.1 AESI Completion Guidelines V2.0_eff 22Jun2022_rev 08Apr2025.pdf | Regulatory Document | .pdf | 217 | Low |
| 9.1 SAE Report Form Completion Guidelines V4.0_eff 22Jun2022_rev 08Apr2025.pdf | Regulatory Document | .pdf | 194 | Low |
| VALIDATION_PROTOCOL_001_030_SIV_FUL_Boynton_29JUL2025.pdf | Regulatory Document | .pdf | 180 | Low |
| DxB-220 Project specs_SITE Final Ver4.docx | Regulatory Document | .docx | 176 | Low |
| 5.10  Site Delegation of Authority Log_Approved.docx | Regulatory Document | .docx | 169 | Low |
| Site Training Form.docx | Regulatory Document | .docx | 49 | Low |
| Coologics_ VVC Training Guide_FINAL_19JUN2025.pdf | Unknown | .pdf | 16022 | Low |
| Spanish-GW-Patient-Navigator-Guide-2025 (1).pdf | Unknown | .pdf | 14429 | Low |
| Letter of Inventory.pdf | Unknown | .pdf | 1631 | Low |
| AB30104_6_7-5150UG v5.pdf | Unknown | .pdf | 1469 | Low |
| Testing Plan LIAISON Calprotectin 3.0_Rev.A_30062025.pdf | Unknown | .pdf | 1228 | Low |
| Verified Copy - System Description.pdf | Unknown | .pdf | 873 | Low |
| AoR.pdf | Unknown | .pdf | 816 | Low |
| ODM1-2-0.html | Unknown | .html | 606 | Low |
| AB30104_6_7-5151QRG-esUS-final.pdf | Unknown | .pdf | 583 | Low |
| AB30104_6_7-5151QRG-enUS v1.pdf | Unknown | .pdf | 461 | Low |
| NODE-303_QRG v4_08Jul2021_final.pdf | Unknown | .pdf | 438 | Low |
| SAO4_SP400 Cytology_Vilo.pdf | Unknown | .pdf | 414 | Low |
| mRNA-1647-P301 Annotated_04May.pdf | Unknown | .pdf | 411 | Low |
| V.03 - Validation Report.pdf | Unknown | .pdf | 370 | Low |
| Roundcube Webmail __ VALIDATION_PROTOCOL_001_Important Study Update _Clarification on Screening Window Extension Request Guidelines.pdf | Unknown | .pdf | 317 | Low |
| 60+ Normal Healthy CRSPTL-00101_FINAL.pdf | Unknown | .pdf | 298 | Low |
| APPENDICES SUPPORTING DOCUMENTATION AND OPERATIONAL.pdf | Unknown | .pdf | 282 | Low |
| Close-Out Follow Up mRNA-1647-P301, 13-Jan-2026.pdf | Unknown | .pdf | 147 | Low |
| mRNA-1647-P301 Blank_04May.pdf | Unknown | .pdf | 110 | Low |
| Essential_Documents_for_Conduct_of_Clinical_Trial_Checklist (1).docx | Unknown | .docx | 61 | Low |
| VILO RESEARCH GROUP VRG_BIO_001 Final - Copy (3) (1).docx | Unknown | .docx | 41 | Low |
| VILO RESEARCH GROUP VRG_BIO_001 Final - Copy (3).docx | Unknown | .docx | 41 | Low |
| desktop.ini | Unknown | .ini | 6 | Low |
| CORPUS-INVENTORY.md | Unknown | .md | 3 | Low |
| README.md | Unknown | .md | 2 | Low |
| CONFIDENTIALITY-POLICY.md | Unknown | .md | 1 | Low |
| 10. INCEPTION CRF Completion Guidelines v2.0_03Nov2021 (1).docx | eCRF Guideline | .docx | 31751 | High |
| 10. INCEPTION CRF Completion Guidelines v2.0_03Nov2021 (1).pdf | eCRF Guideline | .pdf | 15945 | High |
| VALIDATION_PROTOCOL_002_eCRF Completion Guidelines_Version 5.0_07-Apr-2021.docx | eCRF Guideline | .docx | 12254 | High |
| VALIDATION_PROTOCOL_002_eCRF COMPLETION GUIDELINES_V 3.0.docx | eCRF Guideline | .docx | 11860 | High |
| VALIDATION_PROTOCOL_002_eCRF Completion Guidelines_9.0_16Jun2022.pdf | eCRF Guideline | .pdf | 11021 | High |
| VALIDATION_PROTOCOL_002_eCRF COMPLETION GUIDELINES_V 2.0.pdf | eCRF Guideline | .pdf | 4999 | Medium |
| CRF Completion Guidelines_14 Nov 2022.pdf | eCRF Guideline | .pdf | 4677 | Medium |
| 2.4_Paradigm Biopharma VALIDATION_PROTOCOL_001 eCRF Completion Guidelines v2.0_13-Feb-2026.pdf | eCRF Guideline | .pdf | 4597 | Medium |
| VALIDATION_PROTOCOL_001_eCRF Completion Guidelines_Final V3.0_14MAY2026.pdf | eCRF Guideline | .pdf | 4385 | Medium |
| Adamis APC400-03 eCRF Completion Guidelines V1.0_14Oct2021.pdf | eCRF Guideline | .pdf | 2306 | Medium |
| New CRF Guidelines.zip | eCRF Guideline | .zip | 1934 | Low |
| VBVIR78315008_eCRF_Completion_Guidelines_Final (1).pdf | eCRF Guideline | .pdf | 1828 | Low |
| VBVIR78315008_eCRF_Completion_Guidelines_Final.pdf | eCRF Guideline | .pdf | 1828 | Low |
| M16-066_EDC_CCGs_V1.00_Final.pdf | eCRF Guideline | .pdf | 1798 | Low |
| 678354-CS6_CRF Completion Guidelines_v2.0 (1).pdf | eCRF Guideline | .pdf | 1640 | Low |
| 678354-CS6_CRF Completion Guidelines_v2.0.pdf | eCRF Guideline | .pdf | 1640 | Low |
| ALMANAC_eCRF_Completion_Guidelines_1.0_2021_1202.pdf | eCRF Guideline | .pdf | 1193 | Low |
| IMVT-1401-3203 Unique CRFs (1).pdf | eCRF Guideline | .pdf | 1161 | Low |
| IMVT-1401-3203 Unique CRFs.pdf | eCRF Guideline | .pdf | 1161 | Low |
| IMVT-1401-3201 Unique CRFs.pdf | eCRF Guideline | .pdf | 1127 | Low |
| 2.6 VALIDATION_PROTOCOL_001 Blank eCRFs V2.000_17JUL2025.pdf | eCRF Guideline | .pdf | 703 | Low |
| SS of Hepatitis Infection_CRF Template.pdf | eCRF Guideline | .pdf | 397 | Low |
| UDX CRF 5 FINDINGS Ver 08MAR21.pdf | eCRF Guideline | .pdf | 331 | Low |
| UDX CRF 5 FINDINGS Ver 27JAN21.pdf | eCRF Guideline | .pdf | 298 | Low |
| Note_To_File_Blank_CRF_releases_corrected_10Sep2025b.pdf | eCRF Guideline | .pdf | 241 | Low |
| UDX CRF 1 Demo Incl Excl Ver 27JAN21.pdf | eCRF Guideline | .pdf | 220 | Low |
| UDX CRF 5 Procedure COLO Ver 27JAN21.pdf | eCRF Guideline | .pdf | 191 | Low |
| InclusionExclusion CRF_ Rev 2 FINAL.pdf | eCRF Guideline | .pdf | 173 | Low |
| UDX CRF 2A Dig Conditions Ver 27JAN21.pdf | eCRF Guideline | .pdf | 152 | Low |
| VALIDATION_PROTOCOL_002_Unique eCRF_V4.0.pdf | eCRF Guideline | .pdf | 147 | Low |
| VALIDATION_PROTOCOL_002_Unique eCRF_V3.0.pdf | eCRF Guideline | .pdf | 144 | Low |
| UDX CRF 4 Plasma Prep Ver 27JAN21.pdf | eCRF Guideline | .pdf | 117 | Low |
| UDX CRF 5 Top Level Procedure and Findings Ver 27JAN21.pdf | eCRF Guideline | .pdf | 113 | Low |
| UDX CRF 5 Procedure OTHER Ver 27JAN21.pdf | eCRF Guideline | .pdf | 106 | Low |
| UDX CRF 2C Family History Ver 27JAN21.pdf | eCRF Guideline | .pdf | 92 | Low |
| UDX CRF 6 Final Case Sign Off Ver 27JAN21.pdf | eCRF Guideline | .pdf | 89 | Low |
| UDX CRF 5 Prodecure SURG Ver 27JAN21.pdf | eCRF Guideline | .pdf | 82 | Low |
| UDX CRF 2B Non-Dig Conditions Ver 27JAN21.pdf | eCRF Guideline | .pdf | 77 | Low |
| UDX CRF 3 Blood Collection Ver 27JAN21.pdf | eCRF Guideline | .pdf | 54 | Low |
