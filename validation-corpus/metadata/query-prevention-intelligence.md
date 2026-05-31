# Query Prevention Intelligence

## 1. Overview
The most expensive part of a clinical trial for a site is the administrative burden of resolving data queries. VIP's goal is to predict and eliminate queries *before* the data is exported to the Sponsor's EDC.

## 2. Prevention Vectors

### Missing Data Queries
- **What the CRA will see:** Blank fields in the source document (e.g., missing vitals time, missing AE severity).
- **VIP Defense:** "Missing Timestamp Detected. Probability of Query: 99%. Action: Mandate coordinator input before marking visit as Complete."

### Inconsistent Source Queries
- **What the CRA will see:** Source note says "Mild Headache", but ConMed log says "Taken for Severe Headache".
- **VIP Defense:** Natural Language Processing cross-check. "Discrepancy detected between AE log and ConMed log. Probability of Query: 95%. Action: Prompt CRC to align severity grades."

### Timing/Logic Queries
- **What the CRA will see:** PK Blood Draw (10:00 AM) occurred before IP Administration (10:15 AM).
- **VIP Defense:** Chronology Check. "Trough PK drawn after dosing time. Biological impossibility. Probability of Query: 100%. Action: Prompt CRC to correct timestamp transcription error."

## 3. Site Impact
By preventing these queries locally, the site maintains a pristine "Queries per Page" metric with the Sponsor, establishing a reputation for high-quality data and reducing future monitoring visit frequency (RBM protection).
