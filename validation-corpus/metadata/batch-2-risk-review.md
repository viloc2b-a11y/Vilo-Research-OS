# Batch 2 Risk Review

## PROTOCOL_A003
- **Original Path:** `validation-corpus/inbox/Abbott/Abbott/AL 23/Zepeda/eReg/4. Protocol/4.1 Protocol and Amendments/AL 23 Signed Protocol Version 2 7.5.17.pdf`
- **Why `PHI_STAFF_OR_SITE` was triggered:** The folder path contains `Zepeda`, which is a known Principal Investigator/Staff name.
- **Risk Scope:** Path-only (and potentially document content if the protocol signature page contains the PI's signature). The filename itself is safe.
- **Is it truly patient-specific?** No. It is a site-level regulatory document (Protocol) stored in the site's eReg binder.
- **Reclassification:** **SANITIZATION_READY** (The standard text-extraction pipeline is equipped to scrub the staff name `Zepeda` and sponsor name `Abbott`).

## LAB_MANUAL_A001
- **Original Path:** `validation-corpus/inbox/Acasti/Acasti/ACA-CAP-002/Zepeda/Pt Specific Docs/241593 Cristina Ortuno/4.Labs & Imaging/V1 Screening/241593 Screening Labs tests.pdf`
- **Why `PHI_STAFF_OR_SITE` was triggered:** The path contains `Zepeda` (Staff), `Pt Specific Docs`, and most critically, `241593 Cristina Ortuno` (a real patient name and subject ID).
- **Risk Scope:** Path, Filename, and Document Content. The filename `241593 Screening Labs tests.pdf` contains the subject ID. Given the folder context, the document itself is almost certainly a completed patient lab result report containing active PHI, rather than a blank generic laboratory manual.
- **Is it truly patient-specific?** YES. It explicitly targets a real, named patient subject.
- **Reclassification:** **EXCLUDE** (This file was mistakenly classified as a generic `LAB_MANUAL` during the initial heuristic inventory sweep, but it is actually a `PATIENT_SPECIFIC` source document. It must not be used for generic reader validation).
