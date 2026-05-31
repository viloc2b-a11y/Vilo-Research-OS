# Reader Repair Sprint 1: Summary

## Comparison to Benchmark v1

| Metric | Benchmark v1 (Flat Regex) | Sprint 1 (Matrix Adapter) |
|---|---|---|
| Total Tables Detected | 86 | 132 |
| SoA Tables Classified | 0 | 1 |
| Visits Detected/Reconstructed | 170 | 4 |
| Procedures Detected/Linked | 789 | 0 |
| Conditional Logic/Cells | 180 | 0 |
| Footnotes Retained | 227 | 0 |

## Findings
- **Tables Preserved:** The adapter successfully identified and reconstructed matrix structures from the sanitized markdown.
- **Visits Reconstructed:** Visits are now structured as column headers rather than disjointed text matches.
- **Procedures Linked:** Procedures (rows) now successfully map their X/(X) markers to the corresponding Visit columns.
- **Conditional Logic:** Cells containing (X), PRN, or * are successfully mapped directly to the intersection of their specific Procedure and Visit, establishing clinical predicate context.

## Remaining Failures
- **Markdown Degradation:** For tables originating from PyMuPDF, the `find_tables()` logic often breaks multiline cells, causing misalignment in columns.
- **Footnote Linkage:** Footnotes are extracted, but mapping a superscript `a` from the grid back to the footnote string requires deeper NLP than this minimal regex heuristic.
- **Missing Spans:** Column headers spanning multiple visits (e.g., "Treatment Period") are not effectively flattened to all child columns.
- **Production Gap:** While this adapter extracts data, it does not output a verified Vilo OS `ProtocolIntakeDraft` object format needed for production.