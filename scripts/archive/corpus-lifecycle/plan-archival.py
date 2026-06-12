import os
import json
import csv
from collections import defaultdict

metadata_dir = 'validation-corpus/metadata'
inbox_dir = 'validation-corpus/inbox'
processed_originals_dir = 'validation-corpus/raw/processed-originals'

csv_path = os.path.join(metadata_dir, 'processed-originals-archive-plan.csv')
md_path = os.path.join(metadata_dir, 'processed-originals-archive-plan.md')

mapped_files = {}

for f in os.listdir(metadata_dir):
    if f.endswith('.mapping.json'):
        try:
            with open(os.path.join(metadata_dir, f), 'r', encoding='utf-8') as mf:
                mapping = json.load(mf)
                if 'sanitized_id' in mapping:
                    mapped_files[mapping['sanitized_id']] = mapping
        except Exception as e:
            print(f'Error reading {f}: {e}')

plan_rows = []
counts = {
    'ARCHIVE_ORIGINAL': 0,
    'KEEP_IN_INBOX': 0,
    'NEEDS_MANUAL_REVIEW': 0
}

inbox_files = set()
for root, dirs, files in os.walk(inbox_dir):
    for fname in files:
        inbox_files.add(os.path.join(root, fname).replace(os.sep, '/'))

mapped_paths = set()

for sid, mapping in mapped_files.items():
    orig_path = mapping.get('original_relative_path', '').replace(os.sep, '/')
    target_path = mapping.get('target_path', '').replace(os.sep, '/')
    
    if orig_path: mapped_paths.add(orig_path)
    
    action = 'NEEDS_MANUAL_REVIEW'
    reason = 'Unknown'
    recommended_path = ''
    
    if not orig_path or not os.path.exists(orig_path):
        reason = 'Original file missing'
    elif not target_path or not os.path.exists(target_path):
        reason = 'Sanitized placeholder missing'
    elif orig_path.startswith(processed_originals_dir.replace(os.sep, '/')):
        reason = 'Already in processed-originals'
    else:
        action = 'ARCHIVE_ORIGINAL'
        reason = 'Mapped and extracted successfully in Batch 1'
        filename = os.path.basename(orig_path)
        recommended_path = os.path.join(processed_originals_dir, filename).replace(os.sep, '/')
        
    plan_rows.append({
        'SanitizedID': sid,
        'OriginalPath': orig_path,
        'CurrentStatus': mapping.get('sanitized_artifact_status', 'UNKNOWN'),
        'RecommendedArchivePath': recommended_path,
        'Action': action,
        'Reason': reason
    })
    
    counts[action] += 1

for ipath in inbox_files:
    if ipath not in mapped_paths:
        counts['KEEP_IN_INBOX'] += 1
        plan_rows.append({
            'SanitizedID': 'N/A',
            'OriginalPath': ipath,
            'CurrentStatus': 'UNPROCESSED',
            'RecommendedArchivePath': '',
            'Action': 'KEEP_IN_INBOX',
            'Reason': 'Not mapped or processed yet'
        })

with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'SanitizedID', 'OriginalPath', 'CurrentStatus', 'RecommendedArchivePath', 'Action', 'Reason'
    ])
    writer.writeheader()
    for row in plan_rows:
        writer.writerow(row)

with open(md_path, 'w', encoding='utf-8') as f:
    f.write('# Processed Originals Archival Plan\n\n')
    f.write(f'**Total files scanned in Inbox:** {len(inbox_files)}\n')
    f.write(f'**Mapped documents analyzed:** {len(mapped_files)}\n\n')
    
    f.write('### Recommended Actions\n')
    f.write(f'- **ARCHIVE_ORIGINAL:** {counts["ARCHIVE_ORIGINAL"]} (Batch 1 mapped originals safely extracted)\n')
    f.write(f'- **KEEP_IN_INBOX:** {counts["KEEP_IN_INBOX"]} (Unprocessed raw documents)\n')
    f.write(f'- **NEEDS_MANUAL_REVIEW:** {counts["NEEDS_MANUAL_REVIEW"]} (Mismatches, missing files, or path collisions)\n\n')
    
    f.write('### Archival Targets\n')
    for row in plan_rows:
        if row['Action'] == 'ARCHIVE_ORIGINAL':
            f.write(f"1. `{row['OriginalPath']}` -> `{row['RecommendedArchivePath']}`\n")
            
print('Archival Plan Generated.')
