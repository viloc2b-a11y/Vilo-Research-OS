# Reader Benchmark v1 Failure Analysis

## Reader Weakness Analysis
1. **Missed Visits:** The reader fails to normalize visit names (e.g. "V1" vs "Screening" vs "Week 0") leading to fragmented visit detection.
2. **Missed Windows:** Windows presented in table headers or spanning columns are completely lost in the flattened markdown.
3. **Poor Footnote Handling:** Footnotes at the bottom of the SoA are extracted as orphaned text strings and lose their linking superscript references.
4. **Weak Amendment Interpretation:** Redline text or deleted text in amendments is merged indiscriminately, destroying delta provenance.
5. **Weak Procedure Normalization:** Synonyms ("Vital Signs", "Vitals", "BP/HR") are not grouped.
6. **Weak Conditional Logic Extraction:** "PRN" or "If applicable" is detected but the system does not understand *what* is conditional.
7. **Weak Manual Parsing:** Cannot accurately parse flowcharts or complex branching logic in Lab Manuals.
8. **Weak eCRF Linkage Detection:** eCRF Guides mention variables, but the reader cannot bridge them to the Protocol procedures automatically.
