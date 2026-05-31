# Sanitization Batch 1 Report

**Binary Redaction Confidence:** `UNSAFE_BINARY_REDACTION`

Due to the technical limitations of redacting unstructured PDF and DOCX binary objects safely without risking PHI leakage in metadata, embedded fonts, or invisible layers, all physical binary copies in this batch are flagged as UNSAFE. A dummy Markdown extraction file has been provisioned alongside the copies to satisfy structural reader inputs.


### ECRF_GUIDE_A001
- **Source:** `validation-corpus/inbox\10. INCEPTION CRF Completion Guidelines v2.0_03Nov2021 (1).docx`
- **Target Binary:** `validation-corpus/sanitized\ecrf-guides\ECRF_GUIDE_A001.docx`
- **Target MD:** `validation-corpus/sanitized\ecrf-guides\ECRF_GUIDE_A001.md`
- **Mapping:** `validation-corpus/metadata\ECRF_GUIDE_A001.mapping.json`
- **Redactions Applied:** NONE (Marked UNSAFE_BINARY_REDACTION)
- **Recommended Manual Review Items:** Complete binary scrub or rely exclusively on the markdown extraction pipeline.

### PROTOCOL_A004_AMEND_001
- **Source:** `validation-corpus/inbox\2.1 PARA-OA-012 Protocol Amendment 2 V3.0 23Sep2025.pdf`
- **Target Binary:** `validation-corpus/sanitized\amendments\PROTOCOL_A004_AMEND_001.pdf`
- **Target MD:** `validation-corpus/sanitized\amendments\PROTOCOL_A004_AMEND_001.md`
- **Mapping:** `validation-corpus/metadata\PROTOCOL_A004_AMEND_001.mapping.json`
- **Redactions Applied:** NONE (Marked UNSAFE_BINARY_REDACTION)
- **Recommended Manual Review Items:** Complete binary scrub or rely exclusively on the markdown extraction pipeline.

### PROTOCOL_A005
- **Source:** `validation-corpus/inbox\Budgets\IVD\clinical gen bio\004_Viro_HSV_IgG_LFA_Clinical Protocol_Final.pdf_V1.1 (1).pdf`
- **Target Binary:** `validation-corpus/sanitized\protocols\PROTOCOL_A005.pdf`
- **Target MD:** `validation-corpus/sanitized\protocols\PROTOCOL_A005.md`
- **Mapping:** `validation-corpus/metadata\PROTOCOL_A005.mapping.json`
- **Redactions Applied:** NONE (Marked UNSAFE_BINARY_REDACTION)
- **Recommended Manual Review Items:** Complete binary scrub or rely exclusively on the markdown extraction pipeline.

### PROTOCOL_A007
- **Source:** `validation-corpus/inbox\RFP_DUB-001 version 0.2x_Clinical Study Protocol Synopsis Phase I and 2a_CLEAN (2).pdf`
- **Target Binary:** `validation-corpus/sanitized\protocols\PROTOCOL_A007.pdf`
- **Target MD:** `validation-corpus/sanitized\protocols\PROTOCOL_A007.md`
- **Mapping:** `validation-corpus/metadata\PROTOCOL_A007.mapping.json`
- **Redactions Applied:** NONE (Marked UNSAFE_BINARY_REDACTION)
- **Recommended Manual Review Items:** Complete binary scrub or rely exclusively on the markdown extraction pipeline.

### PROTOCOL_A009
- **Source:** `validation-corpus/inbox\Ingenuity Dual protocol 09Sep25 vus1.0final-signed.pdf`
- **Target Binary:** `validation-corpus/sanitized\protocols\PROTOCOL_A009.pdf`
- **Target MD:** `validation-corpus/sanitized\protocols\PROTOCOL_A009.md`
- **Mapping:** `validation-corpus/metadata\PROTOCOL_A009.mapping.json`
- **Redactions Applied:** NONE (Marked UNSAFE_BINARY_REDACTION)
- **Recommended Manual Review Items:** Complete binary scrub or rely exclusively on the markdown extraction pipeline.

## Correction applied
- **Unsafe binaries removed from sanitized corpus:** All physical PDFs and DOCXs moved to `validation-corpus/raw/review-required/unsafe-binary-redaction/`.
- **Sanitized corpus now contains safe placeholders only:** All `.md` files have been purged of original filenames and any identifying info.
- **Batch 1 not yet usable for reader validation:** Awaiting real scrubbed text extraction.
