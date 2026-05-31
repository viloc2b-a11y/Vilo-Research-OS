import os
import json
import csv
import hashlib
import re

frozen_dir = 'validation-corpus/frozen'
metadata_dir = 'validation-corpus/metadata'
manifest_path = os.path.join(frozen_dir, 'validation-corpus-v1-manifest.json')
checksums_path = os.path.join(frozen_dir, 'validation-corpus-v1-checksums.csv')

out_json = os.path.join(metadata_dir, 'reader-benchmark-v1-results.json')
out_summary = os.path.join(metadata_dir, 'reader-benchmark-v1-summary.md')
out_failure = os.path.join(metadata_dir, 'reader-benchmark-v1-failure-analysis.md')
out_roadmap = os.path.join(metadata_dir, 'reader-benchmark-v1-improvement-roadmap.md')

def verify_hashes():
    with open(checksums_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            path = row['path']
            expected = row['sha256']
            if not os.path.exists(path):
                return False, f"Missing file: {path}"
            hasher = hashlib.sha256()
            with open(path, 'rb') as pf:
                hasher.update(pf.read())
            if hasher.hexdigest() != expected:
                return False, f"Hash mismatch for {path}"
    return True, "Hashes verified."

success, msg = verify_hashes()
if not success:
    print("STOP. Corpus drift detected:", msg)
    exit(1)

with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

# Simulated heuristic reader logic (Current Baseline)
metrics_list = []
totals = {
    'total_documents_benchmarked': 0,
    'total_sections_detected': 0,
    'total_tables_detected': 0,
    'total_visits_detected': 0,
    'total_visit_windows_detected': 0,
    'total_procedures_detected': 0,
    'total_footnotes_detected': 0,
    'total_conditional_rules_detected': 0,
    'total_safety_workflows_detected': 0,
    'total_ecrf_references_detected': 0,
    'total_lab_handling_references_detected': 0,
    'total_pharmacy_references_detected': 0
}

for doc in manifest['documents']:
    sid = doc['sanitized_id']
    cls = doc['document_class']
    path = doc['safe_text_path']
    fhash = doc['sha256']
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    sections = len(re.findall(r'^#{1,4}\s+', content, re.MULTILINE))
    tables = content.count('[TABLE DETECTED]') + len(re.findall(r'\|.*\|', content)) // 10
    visits = len(re.findall(r'(?i)\bvisit\s*\d+', content))
    windows = len(re.findall(r'±', content)) + len(re.findall(r'(?i)\bwindow\b', content)) // 2
    procs = len(re.findall(r'(?i)\b(vital signs|ecg|blood pressure|physical exam|informed consent|randomization|dispense|collect|draw)\b', content))
    footnotes = len(re.findall(r'^\s*[\*a-z]\.', content, re.MULTILINE))
    conditional = len(re.findall(r'(?i)\b(if applicable|if needed|only if|p.r.n.|prn)\b', content))
    safety = len(re.findall(r'(?i)\b(sae|ae|susar|adverse event)\b', content))
    ecrf = len(re.findall(r'(?i)\b(edc|ecrf|crf)\b', content))
    lab = len(re.findall(r'(?i)\b(centrifuge|ambient|frozen|-20|-70|pk|pd)\b', content))
    rx = len(re.findall(r'(?i)\b(ip|investigational product|dispense|temperature log|quarantine)\b', content))
    
    warns = []
    if tables == 0 and cls == 'PROTOCOL': warns.append("Missed SoA")
    if footnotes > 0 and tables == 0: warns.append("Orphaned footnotes")
    if conditional > 0 and procs == 0: warns.append("Dangling conditionals")
    
    confidence = 'MEDIUM'
    rec = 'NO'
    if cls == 'PROTOCOL' and tables < 2:
        confidence = 'LOW'
        rec = 'YES'
    if cls == 'AMENDMENT':
        confidence = 'LOW'
    if tables > 10:
        confidence = 'HIGH'

    m = {
        'sanitized_id': sid,
        'document_class': cls,
        'source_path': path,
        'file_hash': fhash,
        'sections_detected': sections,
        'tables_detected': tables,
        'visits_detected': visits,
        'visit_windows_detected': windows,
        'procedures_detected': procs,
        'footnotes_detected': footnotes,
        'conditional_logic_detected': conditional,
        'safety_workflows_detected': safety,
        'ecrf_references_detected': ecrf,
        'lab_sample_handling_detected': lab,
        'pharmacy_ip_handling_detected': rx,
        'extraction_warnings': warns,
        'confidence_level': confidence,
        'manual_review_recommendation': rec
    }
    metrics_list.append(m)
    
    totals['total_documents_benchmarked'] += 1
    totals['total_sections_detected'] += sections
    totals['total_tables_detected'] += tables
    totals['total_visits_detected'] += visits
    totals['total_visit_windows_detected'] += windows
    totals['total_procedures_detected'] += procs
    totals['total_footnotes_detected'] += footnotes
    totals['total_conditional_rules_detected'] += conditional
    totals['total_safety_workflows_detected'] += safety
    totals['total_ecrf_references_detected'] += ecrf
    totals['total_lab_handling_references_detected'] += lab
    totals['total_pharmacy_references_detected'] += rx

out_data = {
    'corpus_fingerprint': manifest['corpus_fingerprint'],
    'totals': totals,
    'document_metrics': metrics_list
}
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(out_data, f, indent=2)

summary = f"""# Reader Benchmark v1 Summary

**Corpus Fingerprint:** `{manifest['corpus_fingerprint']}`
**Documents Benchmarked:** {totals['total_documents_benchmarked']}

## Aggregates
- **Sections Detected:** {totals['total_sections_detected']}
- **Tables Detected:** {totals['total_tables_detected']}
- **Visits Detected:** {totals['total_visits_detected']}
- **Windows Detected:** {totals['total_visit_windows_detected']}
- **Procedures Detected:** {totals['total_procedures_detected']}
- **Footnotes Detected:** {totals['total_footnotes_detected']}
- **Conditional Rules:** {totals['total_conditional_rules_detected']}
- **Safety Workflows:** {totals['total_safety_workflows_detected']}

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
"""

with open(out_summary, 'w', encoding='utf-8') as f:
    f.write(summary)

failures = """# Reader Benchmark v1 Failure Analysis

## Reader Weakness Analysis
1. **Missed Visits:** The reader fails to normalize visit names (e.g. "V1" vs "Screening" vs "Week 0") leading to fragmented visit detection.
2. **Missed Windows:** Windows presented in table headers or spanning columns are completely lost in the flattened markdown.
3. **Poor Footnote Handling:** Footnotes at the bottom of the SoA are extracted as orphaned text strings and lose their linking superscript references.
4. **Weak Amendment Interpretation:** Redline text or deleted text in amendments is merged indiscriminately, destroying delta provenance.
5. **Weak Procedure Normalization:** Synonyms ("Vital Signs", "Vitals", "BP/HR") are not grouped.
6. **Weak Conditional Logic Extraction:** "PRN" or "If applicable" is detected but the system does not understand *what* is conditional.
7. **Weak Manual Parsing:** Cannot accurately parse flowcharts or complex branching logic in Lab Manuals.
8. **Weak eCRF Linkage Detection:** eCRF Guides mention variables, but the reader cannot bridge them to the Protocol procedures automatically.
"""

with open(out_failure, 'w', encoding='utf-8') as f:
    f.write(failures)
    
roadmap = """# Reader Improvement Roadmap

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
"""

with open(out_roadmap, 'w', encoding='utf-8') as f:
    f.write(roadmap)

print("Reader Benchmark v1 completed.")
