# Reader Repair Sprint 2: Failure Analysis

1. **Colspan Bleed:** When a header like "Double Blind Phase" spans 5 columns, PyMuPDF often assigns the text strictly to the leftmost column (Col 0) and leaves Cols 1-4 blank. The heuristic then misaligns the visits under it.
2. **Missing Multi-Page Stitching:** PyMuPDF `find_tables()` analyzes pages individually. If an SoA matrix spans 3 pages, it generates 3 independent JSON tables. We lack an ID-stitcher to weave them back into a single matrix instance.
3. **DOCX Flattening:** `python-docx` doesn't natively expose cell spans easily without deep XML traversal, so complex DOCX matrices are still slightly misaligned.
