import os
import shutil
import json

sanitized_dir = 'validation-corpus/sanitized'
unsafe_dir = 'validation-corpus/raw/review-required/unsafe-binary-redaction'
metadata_dir = 'validation-corpus/metadata'
registry_file = 'validation-corpus/gold-standard/gold-standard-registry.json'
report_file = os.path.join(metadata_dir, 'sanitization-batch-1-report.md')

os.makedirs(unsafe_dir, exist_ok=True)

batch_targets = [
    {
        'id': 'ECRF_GUIDE_A001',
        'cls': 'ECRF_GUIDE',
        'target_dir': 'ecrf-guides',
        'ext': '.docx'
    },
    {
        'id': 'PROTOCOL_A004_AMEND_001',
        'cls': 'AMENDMENT',
        'target_dir': 'amendments',
        'ext': '.pdf'
    },
    {
        'id': 'PROTOCOL_A005',
        'cls': 'PROTOCOL',
        'target_dir': 'protocols',
        'ext': '.pdf'
    },
    {
        'id': 'PROTOCOL_A007',
        'cls': 'PROTOCOL',
        'target_dir': 'protocols',
        'ext': '.pdf'
    },
    {
        'id': 'PROTOCOL_A009',
        'cls': 'PROTOCOL',
        'target_dir': 'protocols',
        'ext': '.pdf'
    }
]

for t in batch_targets:
    # 1. Move unsafe binaries
    bin_path = os.path.join(sanitized_dir, t['target_dir'], f"{t['id']}{t['ext']}")
    if os.path.exists(bin_path):
        shutil.move(bin_path, os.path.join(unsafe_dir, f"{t['id']}{t['ext']}"))
        
    # 2 & 3. Update MD placeholders
    md_path = os.path.join(sanitized_dir, t['target_dir'], f"{t['id']}.md")
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f"# Sanitized Text Extraction: {t['id']}\n\n")
        f.write(f"**Document Class:** {t['cls']}\n")
        f.write(f"**Status:** PENDING_SAFE_TEXT_EXTRACTION\n")
        f.write(f"**Mapping Reference:** {t['id']}.mapping.json\n\n")
        f.write("[Automated text extraction and scrubbing logic deferred to robust parsing pipeline. No PHI or confidential text exists in this placeholder.]\n")

    # 4. Update Mapping JSONs
    map_file = os.path.join(metadata_dir, f"{t['id']}.mapping.json")
    if os.path.exists(map_file):
        with open(map_file, 'r', encoding='utf-8') as f:
            mapping = json.load(f)
            
        mapping['binary_status'] = 'RAW_REFERENCE_ONLY'
        mapping['sanitized_artifact_status'] = 'PENDING_SAFE_TEXT_EXTRACTION'
        mapping['usable_for_reader_validation'] = False
        
        # update target path to point to unsafe dir for binary
        mapping['unsafe_binary_path'] = os.path.join(unsafe_dir, f"{t['id']}{t['ext']}")
        mapping['target_path'] = md_path # MD is now the only target in sanitized
        
        with open(map_file, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, indent=2)

# 5. Update Registry
if os.path.exists(registry_file):
    with open(registry_file, 'r', encoding='utf-8') as f:
        registry = json.load(f)
        
    for doc in registry.get('documents', []):
        if doc['sanitized_id'] in [t['id'] for t in batch_targets]:
            doc['status'] = 'PENDING_SAFE_TEXT_EXTRACTION'
            doc['usable_for_reader_validation'] = False
            doc['binary_redaction_status'] = 'UNSAFE_BINARY_REDACTION'
            doc['path'] = os.path.join(sanitized_dir, [t['target_dir'] for t in batch_targets if t['id'] == doc['sanitized_id']][0], f"{doc['sanitized_id']}.md")
            
    with open(registry_file, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)

# 6. Update Report
if os.path.exists(report_file):
    with open(report_file, 'a', encoding='utf-8') as f:
        f.write("\n## Correction applied\n")
        f.write("- **Unsafe binaries removed from sanitized corpus:** All physical PDFs and DOCXs moved to `validation-corpus/raw/review-required/unsafe-binary-redaction/`.\n")
        f.write("- **Sanitized corpus now contains safe placeholders only:** All `.md` files have been purged of original filenames and any identifying info.\n")
        f.write("- **Batch 1 not yet usable for reader validation:** Awaiting real scrubbed text extraction.\n")

print("Correction applied successfully.")
