import os
import json
import csv

metadata_dir = 'validation-corpus/metadata'
gold_v3_path = os.path.join(metadata_dir, 'reader-gold-standard-candidates-v3.csv')
plan_v1_path = os.path.join(metadata_dir, 'sanitization-plan-v1.csv')
registry_path = 'validation-corpus/gold-standard/gold-standard-registry.json'

plan_csv = os.path.join(metadata_dir, 'sanitization-plan-batch-2.csv')
plan_md = os.path.join(metadata_dir, 'sanitization-plan-batch-2.md')

registry_ids = set()
if os.path.exists(registry_path):
    with open(registry_path, 'r', encoding='utf-8') as f:
        reg = json.load(f)
        for doc in reg.get('documents', []):
            registry_ids.add(doc['sanitized_id'])
            
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

target_counts = {
    'PROTOCOL': 5,
    'AMENDMENT': 2,
    'ECRF_GUIDE': 2,
    'MANUAL': 1
}

selected = []

def select_candidates(allow_phi=False):
    for c in candidates:
        cid = c['CorpusID']
        cls = c['DocumentClass']
        
        if cls in ['LAB_MANUAL', 'PHARMACY_MANUAL']:
            target_cls = 'MANUAL'
        else:
            target_cls = cls
            
        if target_cls not in target_counts:
            continue
            
        if target_counts[target_cls] <= 0:
            continue
            
        info = v1_info.get(cid, {})
        sanitized_id = info.get('ProposedSanitizedID', '')
        
        if not sanitized_id or sanitized_id in registry_ids:
            continue
            
        status = info.get('Status', 'UNKNOWN')
        risk_flags = info.get('RiskFlags', '')
        
        if not allow_phi and 'PHI_STAFF_OR_SITE' in risk_flags:
            continue
            
        if not allow_phi and 'Pt Specific' in c['OriginalPath']:
            continue
            
        selected.append({
            'SanitizedID': sanitized_id,
            'CorpusID': cid,
            'OriginalPath': c['OriginalPath'],
            'DocumentClass': cls,
            'RiskFlags': risk_flags,
            'V1_Status': status
        })
        registry_ids.add(sanitized_id)
        target_counts[target_cls] -= 1

select_candidates(allow_phi=False)
select_candidates(allow_phi=True)

with open(plan_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['SanitizedID', 'CorpusID', 'DocumentClass', 'OriginalPath', 'RiskFlags', 'V1_Status'])
    writer.writeheader()
    for row in selected:
        writer.writerow(row)
        
with open(plan_md, 'w', encoding='utf-8') as f:
    f.write('# Sanitization Plan - Batch 2\n\n')
    f.write('### Target Quotas\n')
    f.write(f'- PROTOCOLS: 5 (Remaining needed: {target_counts.get("PROTOCOL", 0)})\n')
    f.write(f'- AMENDMENTS: 2 (Remaining needed: {target_counts.get("AMENDMENT", 0)})\n')
    f.write(f'- ECRF_GUIDE: 2 (Remaining needed: {target_counts.get("ECRF_GUIDE", 0)})\n')
    f.write(f'- LAB/PHARMACY MANUAL: 1 (Remaining needed: {target_counts.get("MANUAL", 0)})\n\n')
    
    f.write('### Selected Candidates\n')
    for row in selected:
        f.write(f"#### {row['SanitizedID']} ({row['DocumentClass']})\n")
        f.write(f"- **Original Path:** `{row['OriginalPath']}`\n")
        f.write(f"- **Risk Flags:** {row['RiskFlags'] if row['RiskFlags'] else 'None'}\n")
        f.write(f"- **V1 Status:** {row['V1_Status']}\n\n")

print('Batch 2 Plan Generated.')
