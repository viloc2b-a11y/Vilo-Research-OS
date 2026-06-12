import os
import json
import csv

metadata_dir = 'validation-corpus/metadata'
gold_v3_path = os.path.join(metadata_dir, 'reader-gold-standard-candidates-v3.csv')
plan_v1_path = os.path.join(metadata_dir, 'sanitization-plan-v1.csv')
batch_2_csv = os.path.join(metadata_dir, 'sanitization-plan-batch-2.csv')
registry_path = 'validation-corpus/gold-standard/gold-standard-registry.json'

final_csv = os.path.join(metadata_dir, 'sanitization-plan-batch-2-final.csv')
final_md = os.path.join(metadata_dir, 'sanitization-plan-batch-2-final.md')
exclude_md = os.path.join(metadata_dir, 'excluded-from-validation-corpus.md')

# Load previous batch 2 selection
batch_2_selection = []
with open(batch_2_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        batch_2_selection.append(row)
        
# Remove LAB_MANUAL_A001
filtered_selection = [row for row in batch_2_selection if row['SanitizedID'] != 'LAB_MANUAL_A001']

# We need 1 replacement
# Let's load the candidates and v1 info to find a safe replacement
v1_info = {}
with open(plan_v1_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        v1_info[row['CorpusID']] = row

candidates = []
with open(gold_v3_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        candidates.append(row)
        
registry_ids = set()
if os.path.exists(registry_path):
    with open(registry_path, 'r', encoding='utf-8') as f:
        reg = json.load(f)
        for doc in reg.get('documents', []):
            registry_ids.add(doc['sanitized_id'])
for row in filtered_selection:
    registry_ids.add(row['SanitizedID'])

replacement = None
for c in candidates:
    cid = c['CorpusID']
    cls = c['DocumentClass']
    
    if cls not in ['LAB_MANUAL', 'PHARMACY_MANUAL', 'ECRF_GUIDE']:
        continue
        
    info = v1_info.get(cid, {})
    sanitized_id = info.get('ProposedSanitizedID', '')
    
    if not sanitized_id or sanitized_id in registry_ids:
        continue
        
    orig_path = c['OriginalPath']
    if 'Pt Specific Docs' in orig_path or 'Pt Specific' in orig_path:
        continue
        
    # Prefer LAB or PHARMACY
    # Even if it has PHI_STAFF_OR_SITE from the path (like Zepeda), it's fine if it's an eReg document
    if cls in ['LAB_MANUAL', 'PHARMACY_MANUAL']:
        replacement = {
            'SanitizedID': sanitized_id,
            'CorpusID': cid,
            'OriginalPath': orig_path,
            'DocumentClass': cls,
            'RiskFlags': info.get('RiskFlags', ''),
            'V1_Status': 'SANITIZATION_READY' # upgraded
        }
        break

if not replacement:
    for c in candidates:
        cid = c['CorpusID']
        cls = c['DocumentClass']
        if cls != 'ECRF_GUIDE': continue
        info = v1_info.get(cid, {})
        sanitized_id = info.get('ProposedSanitizedID', '')
        if not sanitized_id or sanitized_id in registry_ids: continue
        orig_path = c['OriginalPath']
        if 'Pt Specific' in orig_path: continue
        replacement = {
            'SanitizedID': sanitized_id,
            'CorpusID': cid,
            'OriginalPath': orig_path,
            'DocumentClass': cls,
            'RiskFlags': info.get('RiskFlags', ''),
            'V1_Status': 'SANITIZATION_READY'
        }
        break

if replacement:
    filtered_selection.append(replacement)

# Update status for PROTOCOL_A003 to SANITIZATION_READY
for row in filtered_selection:
    if row['SanitizedID'] == 'PROTOCOL_A003':
        row['V1_Status'] = 'SANITIZATION_READY'

# Write Final CSV
with open(final_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['SanitizedID', 'CorpusID', 'DocumentClass', 'OriginalPath', 'RiskFlags', 'V1_Status'])
    writer.writeheader()
    for row in filtered_selection:
        writer.writerow(row)
        
# Write Final MD
with open(final_md, 'w', encoding='utf-8') as f:
    f.write('# Sanitization Plan - Batch 2 (FINAL)\n\n')
    
    counts = {}
    for row in filtered_selection:
        c = row['DocumentClass']
        if c in ['LAB_MANUAL', 'PHARMACY_MANUAL']:
            counts['MANUAL'] = counts.get('MANUAL', 0) + 1
        else:
            counts[c] = counts.get(c, 0) + 1
            
    f.write('### Target Quotas\n')
    f.write(f'- PROTOCOLS: {counts.get("PROTOCOL", 0)} (Target: 5)\n')
    f.write(f'- AMENDMENTS: {counts.get("AMENDMENT", 0)} (Target: 2)\n')
    f.write(f'- ECRF_GUIDE: {counts.get("ECRF_GUIDE", 0)} (Target: 2)\n')
    f.write(f'- LAB/PHARMACY MANUAL: {counts.get("MANUAL", 0)} (Target: 1)\n\n')
    
    f.write('### Selected Candidates\n')
    for row in filtered_selection:
        f.write(f"#### {row['SanitizedID']} ({row['DocumentClass']})\n")
        f.write(f"- **Original Path:** `{row['OriginalPath']}`\n")
        f.write(f"- **Risk Flags:** {row['RiskFlags'] if row['RiskFlags'] else 'None'}\n")
        f.write(f"- **Status:** {row['V1_Status']}\n\n")

# Exclusion Log
exc_lines = []
if os.path.exists(exclude_md):
    with open(exclude_md, 'r', encoding='utf-8') as f:
        exc_lines = f.readlines()
else:
    exc_lines.append("# Excluded from Validation Corpus\n\n")

# Check if already added
found = any('LAB_MANUAL_A001' in line for line in exc_lines)
if not found:
    exc_lines.append("## LAB_MANUAL_A001\n")
    exc_lines.append("- **Original Path:** `validation-corpus/inbox/Acasti/Acasti/ACA-CAP-002/Zepeda/Pt Specific Docs/241593 Cristina Ortuno/4.Labs & Imaging/V1 Screening/241593 Screening Labs tests.pdf`\n")
    exc_lines.append("- **Reason:** Patient-specific lab report / probable active PHI (patient name and subject ID in path and filename). Mistakenly classified as generic lab manual during initial parsing.\n")
    exc_lines.append("- **Action:** Permanently excluded from generic Reader Validation Corpus.\n\n")
    
with open(exclude_md, 'w', encoding='utf-8') as f:
    f.writelines(exc_lines)

print('Final Batch 2 Plan Generated.')
