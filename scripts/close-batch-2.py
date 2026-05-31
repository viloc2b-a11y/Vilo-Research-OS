import os
import json
import shutil

metadata_dir = 'validation-corpus/metadata'
inbox_dir = 'validation-corpus/inbox'
processed_dir = 'validation-corpus/raw/processed-originals'
failed_dir = 'validation-corpus/raw/review-required/failed-extraction'
registry_file = 'validation-corpus/gold-standard/gold-standard-registry.json'
report_file = os.path.join(metadata_dir, 'batch-2-lifecycle-closeout.md')

os.makedirs(processed_dir, exist_ok=True)
os.makedirs(failed_dir, exist_ok=True)

batch2_ids = [
    'ECRF_GUIDE_A002', 'ECRF_GUIDE_A003',
    'PROTOCOL_A004_AMEND_002', 'PROTOCOL_A004_AMEND_003',
    'PROTOCOL_A010', 'PROTOCOL_A011', 'PROTOCOL_A012', 'PROTOCOL_A014', 'PROTOCOL_A003',
    'PHARMACY_MANUAL_A001'
]

report_lines = []
report_lines.append("# Batch 2 Lifecycle Closeout\n")

successful = []
failed = []

for bid in batch2_ids:
    mf_path = os.path.join(metadata_dir, f"{bid}.mapping.json")
    if not os.path.exists(mf_path):
        continue
        
    with open(mf_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
        
    status = mapping.get('sanitized_artifact_status')
    source_path = mapping.get('original_relative_path')
    
    # Try finding exact match, otherwise search by filename
    found_path = None
    if source_path and os.path.exists(source_path):
        found_path = source_path
    elif source_path:
        filename = os.path.basename(source_path)
        for root, _, files in os.walk(inbox_dir):
            if filename in files:
                found_path = os.path.join(root, filename)
                break
                
    if not found_path:
        print(f"File not found for {bid}")
        continue
        
    filename = os.path.basename(found_path)
    
    if status == 'SAFE_TEXT_EXTRACTED':
        target_path = os.path.join(processed_dir, filename).replace(os.sep, '/')
        shutil.move(found_path, target_path)
        mapping['processed_original_path'] = target_path
        successful.append(f"`{found_path}` -> `{target_path}`")
    elif status == 'NEEDS_MANUAL_REVIEW':
        target_path = os.path.join(failed_dir, filename).replace(os.sep, '/')
        shutil.move(found_path, target_path)
        mapping['failed_extraction_path'] = target_path
        failed.append(f"`{found_path}` -> `{target_path}`")
        
    with open(mf_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)

report_lines.append("### Successfully Archived Originals")
for s in successful:
    report_lines.append("- " + s)
report_lines.append(f"\n**Total:** {len(successful)}\n")

report_lines.append("### Failed Extraction (Moved to Review-Required)")
for f in failed:
    report_lines.append("- " + f)
report_lines.append(f"\n**Total:** {len(failed)}\n")

# Count remaining inbox
inbox_count = 0
for root, _, files in os.walk(inbox_dir):
    inbox_count += len(files)
    
report_lines.append(f"### Inbox Status\n- **Remaining Inbox Count:** {inbox_count}")

with open(report_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_lines))

print("Batch 2 Closeout Completed.")
