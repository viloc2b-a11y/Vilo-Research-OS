# Sprint 3 Failure Analysis

- **Footnote Complexity:** We successfully mapped procedures, but safely extracting individual footnotes scattered in cell strings and linking them reliably to the bottom of the table requires LLM intervention. RegEx heuristics are insufficient for "1b,c" or "*^".
- **Span Collapse:** Multi-page stitching succeeded for generic uniform grids, but if the row header spans change halfway through a page, the stitcher considers it a new table.
- **Conditional Logic:** Complex multi-part conditionals ("only if Visit 1 HR > 100") cannot be normalized purely algorithmically. We mapped the `extracted_value` accurately, but `normalized_value` falls back to `conditional`.
