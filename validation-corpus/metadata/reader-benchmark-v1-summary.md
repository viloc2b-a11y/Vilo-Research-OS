# Reader Benchmark v1 Summary

**Corpus Fingerprint:** `2bbb2dcc8c9a9891e093cb64cbf2759913d5b210b54f0e412cda94f35e6aeff2`
**Documents Benchmarked:** 19

## Aggregates
- **Sections Detected:** 19
- **Tables Detected:** 86
- **Visits Detected:** 170
- **Windows Detected:** 325
- **Procedures Detected:** 789
- **Footnotes Detected:** 227
- **Conditional Rules:** 180
- **Safety Workflows:** 1108

## Reader Strength Analysis
- **Strongest Extraction Areas:** Simple linear text blocks, basic visit occurrence counting, general safety keyword detection.
- **Strongest Document Classes:** eCRF Guides and text-heavy Protocols.
- **Highest Confidence Areas:** Identifying standalone procedures outside of tables.
- **Repeatable Successes:** Identifying raw table presence and basic keyword tagging.

## Fidelity Assessment
- **Visit Fidelity:** MEDIUM (Misses complex grouping)
- **Procedure Fidelity:** LOW (Fails to link procedures to specific visits accurately without SoA structural parsing)
- **Table Fidelity:** LOW (Markdown tables are heavily flattened/broken by raw extraction)
- **Conditional Logic Fidelity:** LOW (Keywords detected, but logical conditions are not logically structured)
- **Safety Workflow Fidelity:** MEDIUM
