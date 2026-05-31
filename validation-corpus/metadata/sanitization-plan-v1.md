# Sanitization Plan v1

**Total Candidates Reviewed:** 30
**Candidates Ready:** 18
**Needing Manual Review:** 12
**Excluded Candidates:** 0

### Risk Flags Identified
- PHI_STAFF_OR_SITE: 12
- SPONSOR_NAME: 13
- PROTOCOL_NUMBER: 5

### Recommended Batch 1
- **ECRF_GUIDE_A001** (ECRF_GUIDE)
  - Original: `10. INCEPTION CRF Completion Guidelines v2.0_03Nov2021 (1).docx`
  - Target: `validation-corpus/sanitized/ecrf-guides/ECRF_GUIDE_A001.docx`
- **PROTOCOL_A004_AMEND_001** (AMENDMENT)
  - Original: `2.1 PARA-OA-012 Protocol Amendment 2 V3.0 23Sep2025.pdf`
  - Target: `validation-corpus/sanitized/protocols/PROTOCOL_A004_AMEND_001.pdf`
- **PROTOCOL_A005** (PROTOCOL)
  - Original: `004_Viro_HSV_IgG_LFA_Clinical Protocol_Final.pdf_V1.1 (1).pdf`
  - Target: `validation-corpus/sanitized/protocols/PROTOCOL_A005.pdf`
- **PROTOCOL_A007** (PROTOCOL)
  - Original: `RFP_DUB-001 version 0.2x_Clinical Study Protocol Synopsis Phase I and 2a_CLEAN (2).pdf`
  - Target: `validation-corpus/sanitized/protocols/PROTOCOL_A007.pdf`
- **PROTOCOL_A009** (PROTOCOL)
  - Original: `Ingenuity Dual protocol 09Sep25 vus1.0final-signed.pdf`
  - Target: `validation-corpus/sanitized/protocols/PROTOCOL_A009.pdf`

### Risk Notes
- **Protocol Numbers & Sponsor Names:** Heavily present across filenames and paths. Standard procedure is to replace all instances in the document text with the `ProposedSanitizedID` or `[SPONSOR]` tags.
- **Site/Staff PHI:** A few paths contain names associated with site staff or PI folders. These have been marked for manual review before entering the pipeline.
