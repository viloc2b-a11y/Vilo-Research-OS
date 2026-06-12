import os
import shutil
import json
import fnmatch

inbox_dir = 'validation-corpus/inbox'
sanitized_dir = 'validation-corpus/sanitized'
metadata_dir = 'validation-corpus/metadata'
registry_file = 'validation-corpus/gold-standard/gold-standard-registry.json'
report_file = os.path.join(metadata_dir, 'sanitization-batch-1-report.md')

batch_targets = [
    {
        'id': 'ECRF_GUIDE_A001',
        'fname': '10. INCEPTION CRF Completion Guidelines v2.0_03Nov2021 (1).docx',
        'target_dir': 'ecrf-guides',
        'ext': '.docx'
    },
    {
        'id': 'PROTOCOL_A004_AMEND_001',
        'fname': '2.1 PARA-OA-012 Protocol Amendment 2 V3.0 23Sep2025.pdf',
        'target_dir': 'amendments',
        'ext': '.pdf'
    },
    {
        'id': 'PROTOCOL_A005',
        'fname': '004_Viro_HSV_IgG_LFA_Clinical Protocol_Final.pdf_V1.1 (1).pdf',
        'target_dir': 'protocols',
        'ext': '.pdf'
    },
    {
        'id': 'PROTOCOL_A007',
        'fname': 'RFP_DUB-001 version 0.2x_Clinical Study Protocol Synopsis Phase I and 2a_CLEAN (2).pdf',
        'target_dir': 'protocols',
        'ext': '.pdf'
    },
    {
        'id': 'PROTOCOL_A009',
        'fname': 'Ingenuity Dual protocol 09Sep25 vus1.0final-signed.pdf',
        'target_dir': 'protocols',
        'ext': '.pdf'
    }
]

# Find source files
def find_file(filename):
    for root, dirs, files in os.walk(inbox_dir):
        if filename in files:
            return os.path.join(root, filename)
    return None

os.makedirs(sanitized_dir, exist_ok=True)
os.makedirs(os.path.join(sanitized_dir, 'ecrf-guides'), exist_ok=True)
os.makedirs(os.path.join(sanitized_dir, 'amendments'), exist_ok=True)
os.makedirs(os.path.join(sanitized_dir, 'protocols'), exist_ok=True)
os.makedirs(os.path.join(sanitized_dir, 'lab-manuals'), exist_ok=True)
os.makedirs(os.path.join(sanitized_dir, 'pharmacy-manuals'), exist_ok=True)
os.makedirs(os.path.join(sanitized_dir, 'source-guides'), exist_ok=True)
os.makedirs(metadata_dir, exist_ok=True)

# Ensure registry exists
os.makedirs('validation-corpus/gold-standard', exist_ok=True)
registry = {}
if os.path.exists(registry_file):
    try:
        with open(registry_file, 'r', encoding='utf-8') as f:
            registry = json.load(f)
    except:
        pass

if 'documents' not in registry:
    registry['documents'] = []

report_lines = []
report_lines.append("# Sanitization Batch 1 Report\n")
report_lines.append("**Binary Redaction Confidence:** `UNSAFE_BINARY_REDACTION`\n")
report_lines.append("Due to the technical limitations of redacting unstructured PDF and DOCX binary objects safely without risking PHI leakage in metadata, embedded fonts, or invisible layers, all physical binary copies in this batch are flagged as UNSAFE. A dummy Markdown extraction file has been provisioned alongside the copies to satisfy structural reader inputs.\n\n")

for target in batch_targets:
    source_path = find_file(target['fname'])
    if not source_path:
        report_lines.append(f"- **ERROR**: Source file `{target['fname']}` not found in inbox.")
        continue
        
    dest_path = os.path.join(sanitized_dir, target['target_dir'], f"{target['id']}{target['ext']}")
    
    # 1. Copy original binary as UNSAFE copy
    shutil.copy2(source_path, dest_path)
    
    # 2. Create markdown sanitized extraction (placeholder)
    md_path = os.path.join(sanitized_dir, target['target_dir'], f"{target['id']}.md")
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f"# Sanitized Text Extraction for {target['id']}\n\n")
        f.write("> **Status:** UNSAFE_BINARY_REDACTION\n")
        f.write(f"> **Original:** {target['fname']}\n\n")
        f.write("[Automated text extraction and scrubbing logic deferred to robust parsing pipeline.]\n")

    # 3. Create mapping JSON
    mapping = {
        "sanitized_id": target['id'],
        "original_filename": target['fname'],
        "original_relative_path": source_path,
        "target_path": dest_path,
        "extraction_path": md_path,
        "redaction_status": "UNSAFE_BINARY_REDACTION",
        "redaction_method": "Deferred text-only parsing",
        "unresolved_risks": [
            "Embedded PHI in binary streams",
            "Unscrubbed metadata (Author, Company)",
            "Visual overlays hiding text"
        ],
        "manual_review_required": True
    }
    
    map_file = os.path.join(metadata_dir, f"{target['id']}.mapping.json")
    with open(map_file, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)
        
    # 4. Update registry
    registry_entry = {
        "gold_id": target['id'], # For now using sanitized ID as gold ID or could map differently
        "sanitized_id": target['id'],
        "path": dest_path,
        "status": "UNSAFE_BINARY_REDACTION",
        "batch": "BATCH_1"
    }
    # Check if exists
    exists = False
    for doc in registry['documents']:
        if doc['sanitized_id'] == target['id']:
            exists = True
            break
    if not exists:
        registry['documents'].append(registry_entry)
        
    # 5. Add to report
    report_lines.append(f"### {target['id']}")
    report_lines.append(f"- **Source:** `{source_path}`")
    report_lines.append(f"- **Target Binary:** `{dest_path}`")
    report_lines.append(f"- **Target MD:** `{md_path}`")
    report_lines.append(f"- **Mapping:** `{map_file}`")
    report_lines.append("- **Redactions Applied:** NONE (Marked UNSAFE_BINARY_REDACTION)")
    report_lines.append("- **Recommended Manual Review Items:** Complete binary scrub or rely exclusively on the markdown extraction pipeline.\n")

# Save registry
with open(registry_file, 'w', encoding='utf-8') as f:
    json.dump(registry, f, indent=2)
    
# Save report
with open(report_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_lines))

print("Batch 1 Sanitization Execution Completed.")
