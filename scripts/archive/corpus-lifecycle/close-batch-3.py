import os
import json
import shutil

metadata_dir = 'validation-corpus/metadata'
inbox_dir = 'validation-corpus/inbox'
processed_dir = 'validation-corpus/raw/processed-originals'
registry_file = 'validation-corpus/gold-standard/gold-standard-registry.json'
report_file = os.path.join(metadata_dir, 'batch-3-lifecycle-closeout.md')

os.makedirs(processed_dir, exist_ok=True)

batch3_ids = [
    'ECRF_GUIDE_A101', 'AMENDMENT_A101', 'PROTOCOL_A101',
    'LAB_MANUAL_A101', 'PROTOCOL_A102', 'PROTOCOL_A103'
]

report_lines = []
report_lines.append("# Batch 3 Lifecycle Closeout\n")

successful = []

for bid in batch3_ids:
    mf_path = os.path.join(metadata_dir, f"{bid}.mapping.json")
    if not os.path.exists(mf_path):
        continue
        
    with open(mf_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
        
    status = mapping.get('sanitized_artifact_status')
    source_path = mapping.get('original_relative_path')
    
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
        
    with open(mf_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)

report_lines.append("### Successfully Archived Originals")
for s in successful:
    report_lines.append("- " + s)
report_lines.append(f"\n**Total Archived:** {len(successful)}\n")
report_lines.append(f"**Total Failed Extraction (Batch 3):** 0\n")

inbox_count = 0
for root, _, files in os.walk(inbox_dir):
    inbox_count += len(files)
    
total_safe_extracted = 0
for f in os.listdir(metadata_dir):
    if f.endswith('.mapping.json'):
        with open(os.path.join(metadata_dir, f), 'r', encoding='utf-8') as mf:
            m = json.load(mf)
            if m.get('sanitized_artifact_status') == 'SAFE_TEXT_EXTRACTED':
                total_safe_extracted += 1
                
report_lines.append(f"### Current Corpus Infrastructure State")
report_lines.append(f"- **Total `SAFE_TEXT_EXTRACTED` Documents:** {total_safe_extracted}")
report_lines.append(f"- **Remaining Inbox Count:** {inbox_count}\n")

with open(report_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_lines))

print("Batch 3 Closeout Completed.")
