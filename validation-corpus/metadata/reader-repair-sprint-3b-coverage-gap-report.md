# Reader Repair Sprint 3B: Coverage Gap Report

**Total Frozen Documents:** 19
**Parser Results Generated:** 14
**Coverage Gap:** 5 missing documents.

## Missing Document Analysis

### ECRF_GUIDE_A001 (ECRF_GUIDE)
- **Has Structured Tables JSON:** False
- **Tables Detected:** 0
- **SoA Tables Detected:** 0
- **Reason Not Processed:** `BUG`
- **Determination:** `NEEDS_REPAIR`

### PROTOCOL_A004_AMEND_001 (AMENDMENT)
- **Has Structured Tables JSON:** False
- **Tables Detected:** 0
- **SoA Tables Detected:** 0
- **Reason Not Processed:** `BUG`
- **Determination:** `NEEDS_REPAIR`

### PROTOCOL_A005 (PROTOCOL)
- **Has Structured Tables JSON:** False
- **Tables Detected:** 0
- **SoA Tables Detected:** 0
- **Reason Not Processed:** `BUG`
- **Determination:** `NEEDS_REPAIR`

### PROTOCOL_A007 (PROTOCOL)
- **Has Structured Tables JSON:** False
- **Tables Detected:** 0
- **SoA Tables Detected:** 0
- **Reason Not Processed:** `BUG`
- **Determination:** `NEEDS_REPAIR`

### PROTOCOL_A009 (PROTOCOL)
- **Has Structured Tables JSON:** False
- **Tables Detected:** 0
- **SoA Tables Detected:** 0
- **Reason Not Processed:** `BUG`
- **Determination:** `NEEDS_REPAIR`

## Updated Readiness Assessment

**A. Protocol Intake Production:** NOT READY
*(Failed because pipeline bugs bypassed 5 Batch 1 documents due to `unsafe_binary_path` reference structures. Cannot deploy intake if older safe documents fail extraction).*

**B. Document Intelligence Production:** READY
*(Extraction is stable for RAG indexing).*

**C. SoA Extraction Production:** NOT READY
*(Cannot declare readiness while a known subset of the corpus fails parsing entirely due to a path lookup bug).*

**D. Source Generation Production:** NOT READY
*(Human reconciliation review gate remains outstanding; logic nuances unvalidated).*