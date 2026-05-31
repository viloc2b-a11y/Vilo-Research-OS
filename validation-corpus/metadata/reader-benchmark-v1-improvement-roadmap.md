# Reader Improvement Roadmap

## Top 10 High-Impact Improvements

1. **SoA Table Structural Reconstruction Engine:** Move beyond flattened markdown tables into a 2D JSON grid extractor to preserve row/col intersections.
2. **Footnote Resolution Linker:** Heuristic to map trailing alphabetical footnotes back to procedure rows or visit columns in the SoA.
3. **Amendment Delta Parsing:** Integrate diff detection to understand strikethroughs and additions in Amendment PDFs.
4. **Visit Normalization Layer:** Create a canonical visit timeline model (Screening -> Baseline -> Treatment -> Follow-up).
5. **Procedure Ontology Mapping:** Map raw procedure strings to standard LOINC/SNOMED or canonical internal codes.
6. **Conditional Logic Parser:** Use an LLM or syntax tree to determine the predicate and subject of PRN rules.
7. **Provenance Tracking:** Maintain PDF bounding box coordinates to allow UI highlighting of extracted data.
8. **Confidence Scoring Engine:** Base confidence on structural integrity rather than raw keyword counts.
9. **Lab Kit Integration:** Map protocol PK/PD procedures explicitly to Lab Manual handling steps.
10. **Cross-Document Entity Resolution:** Bridge Protocol IDs and PI names across disparate manual files.

## Production Readiness Assessment (Current Reader)
- **A. Protocol Intake Production:** **NOT READY** (Loss of SoA structure prevents safe ingest)
- **B. Document Intelligence Production:** **PARTIALLY READY** (Can be used for basic search/semantic RAG, but not structured data extraction)
- **C. SoA Extraction Production:** **NOT READY** (Table flattening is catastrophic for clinical timelines)
- **D. Source Generation Production:** **NOT READY** (Lack of structural fidelity guarantees dangerous hallucinations in source creation)
