import os
import json
import csv
import re

metadata_dir = 'validation-corpus/metadata'
gold_v3_path = os.path.join(metadata_dir, 'reader-gold-standard-candidates-v3.csv')
master_path = os.path.join(metadata_dir, 'master-corpus-inventory.csv')
registry_path = 'validation-corpus/gold-standard/gold-standard-registry.json'
excluded_md = os.path.join(metadata_dir, 'excluded-from-validation-corpus.md')

plan_csv = os.path.join(metadata_dir, 'sanitization-plan-batch-3.csv')
plan_md = os.path.join(metadata_dir, 'sanitization-plan-batch-3.md')

registry_paths = set()
registry_ids = set()
if os.path.exists(registry_path):
    with open(registry_path, 'r', encoding='utf-8') as f:
        reg = json.load(f)
        for doc in reg.get('documents', []):
            registry_ids.add(doc['gold_id'])
            # Actually we need original paths of processed documents to skip them.
            # But the registry doesn't store original path natively, it stores target path.
            # However, we can look up all mapping JSONs to get processed original paths.

processed_paths = set()
for f in os.listdir(metadata_dir):
    if f.endswith('.mapping.json'):
        with open(os.path.join(metadata_dir, f), 'r', encoding='utf-8') as mf:
            m = json.load(mf)
            if 'original_relative_path' in m:
                processed_paths.add(m['original_relative_path'].replace('\\', '/').lower())

excluded_paths = set()
if os.path.exists(excluded_md):
    with open(excluded_md, 'r', encoding='utf-8') as f:
        content = f.read()
        # Extract paths in backticks
        matches = re.findall(r'`(.*?)`', content)
        for m in matches:
            excluded_paths.add(m.replace('\\', '/').lower())

phi_keywords = ['zepeda', 'boynton', 'ojeas', 'missy']
sponsor_keywords = ['abbvie', 'abbott', 'acasti', 'allergan', 'gilead', 'paradigm', 'adamis', 'ingenuity', 'coologics', 'boca bio', 'clinica gen bio', 'novartis', 'moderna', 'immunovant']
protocol_keywords = ['para-oa-012', 'para_oa_012', 'mrna-1647', 'imvt-1401', 'crsptl', 'm16-066', 'm14-533', 'udx', 'cgb001', 'app030', 'mv40618', 'rfp_dub-001', 'inception', 'gs-us-553-9020', 'lin-md-64', 'aca-cap-002', 'al 23']

def get_risk_flags(path):
    flags = []
    path_lower = path.lower()
    for kw in phi_keywords:
        if kw in path_lower:
            flags.append('PHI_STAFF_OR_SITE')
            break
    for kw in sponsor_keywords:
        if kw in path_lower:
            flags.append('SPONSOR_NAME')
            break
    for kw in protocol_keywords:
        if kw in path_lower:
            flags.append('PROTOCOL_NUMBER')
            break
    return '|'.join(flags) if flags else 'NONE'

candidates_pool = []
seen_paths = set()

def load_pool(file_path):
    if not os.path.exists(file_path): return
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            p = row['OriginalPath'].replace('\\', '/')
            p_lower = p.lower()
            if p_lower in processed_paths or p_lower in excluded_paths or p_lower in seen_paths:
                continue
            if row['Extension'].lower() in ['.zip', '.pptx', '.html', '.eml']:
                continue
            if 'pt specific docs' in p_lower or 'pt specific' in p_lower:
                continue
            if row['DocumentClass'] in ['BUDGET', 'CTA', 'IRB', 'MONITORING', 'TRAINING', 'PATIENT_SPECIFIC', 'OTHER']:
                continue
                
            seen_paths.add(p_lower)
            row['OriginalPath'] = p
            row['RiskFlags'] = get_risk_flags(p)
            candidates_pool.append(row)

load_pool(gold_v3_path)
load_pool(master_path)

target_counts = {
    'PROTOCOL': 3,
    'AMENDMENT': 1,
    'ECRF_GUIDE': 1,
    'MANUAL': 1
}

selected = []
replacements = []

def select_for_targets(allow_phi=False):
    global candidates_pool
    rem_pool = []
    for c in candidates_pool:
        cls = c['DocumentClass']
        target_cls = 'MANUAL' if cls in ['LAB_MANUAL', 'PHARMACY_MANUAL'] else cls
        
        if target_cls not in target_counts or target_counts[target_cls] <= 0:
            rem_pool.append(c)
            continue
            
        if not allow_phi and 'PHI_STAFF_OR_SITE' in c['RiskFlags']:
            rem_pool.append(c)
            continue
            
        # Select
        # Determine an ID
        idx = 1
        while True:
            # Check if PROTOCOL_A0xx exists
            new_id = f"{cls}_B3_{idx:03d}"
            # Actually we can just use BATCH_3 prefix to avoid ID collisions entirely
            prefix = target_cls if target_cls != 'MANUAL' else cls
            new_id = f"{prefix}_A{100+idx}" # Arbitrary high numbers to not overlap V1
            
            # Simple check
            conflict = False
            for s in selected:
                if s['SanitizedID'] == new_id: conflict = True
            for r in registry_ids:
                if r == new_id: conflict = True
            if not conflict:
                break
            idx += 1
            
        selected.append({
            'SanitizedID': new_id,
            'CorpusID': c.get('CorpusID', 'UNKNOWN'),
            'OriginalPath': c['OriginalPath'],
            'DocumentClass': cls,
            'RiskFlags': c['RiskFlags'],
            'Status': 'SANITIZATION_READY'
        })
        target_counts[target_cls] -= 1
    candidates_pool = rem_pool

select_for_targets(allow_phi=False)
select_for_targets(allow_phi=True)

# Find 1 replacement for each category if possible
rep_counts = {'PROTOCOL': 1, 'AMENDMENT': 1, 'ECRF_GUIDE': 1, 'MANUAL': 1}
for c in candidates_pool:
    cls = c['DocumentClass']
    target_cls = 'MANUAL' if cls in ['LAB_MANUAL', 'PHARMACY_MANUAL'] else cls
    if target_cls in rep_counts and rep_counts[target_cls] > 0:
        if 'PHI_STAFF_OR_SITE' not in c['RiskFlags']:
            replacements.append({
                'SanitizedID': 'REPLACEMENT',
                'CorpusID': c.get('CorpusID', 'UNKNOWN'),
                'OriginalPath': c['OriginalPath'],
                'DocumentClass': cls,
                'RiskFlags': c['RiskFlags'],
                'Status': 'BACKUP'
            })
            rep_counts[target_cls] -= 1

# Write CSV
with open(plan_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['SanitizedID', 'CorpusID', 'DocumentClass', 'OriginalPath', 'RiskFlags', 'Status'])
    writer.writeheader()
    for row in selected:
        writer.writerow(row)
    for row in replacements:
        writer.writerow(row)
        
# Write MD
with open(plan_md, 'w', encoding='utf-8') as f:
    f.write('# Sanitization Plan - Batch 3\n\n')
    f.write('### Target Quotas\n')
    f.write(f'- PROTOCOLS: 3 (Remaining needed: {target_counts.get("PROTOCOL", 0)})\n')
    f.write(f'- AMENDMENTS: 1 (Remaining needed: {target_counts.get("AMENDMENT", 0)})\n')
    f.write(f'- ECRF_GUIDE: 1 (Remaining needed: {target_counts.get("ECRF_GUIDE", 0)})\n')
    f.write(f'- LAB/PHARMACY MANUAL: 1 (Remaining needed: {target_counts.get("MANUAL", 0)})\n\n')
    
    f.write('### Selected Candidates\n')
    for row in selected:
        f.write(f"#### {row['SanitizedID']} ({row['DocumentClass']})\n")
        f.write(f"- **Original Path:** `{row['OriginalPath']}`\n")
        f.write(f"- **Risk Flags:** {row['RiskFlags']}\n")
        f.write(f"- **Status:** {row['Status']}\n\n")

    f.write('### Replacement Candidates (Backups)\n')
    for row in replacements:
        f.write(f"#### BACKUP ({row['DocumentClass']})\n")
        f.write(f"- **Original Path:** `{row['OriginalPath']}`\n")
        f.write(f"- **Risk Flags:** {row['RiskFlags']}\n\n")
        
    f.write('### Manual Review Notes\n')
    f.write('- The selection engine actively filtered out any paths containing `Pt Specific` directories.\n')
    f.write('- Fallbacks to the Master Inventory were used if the V3 Gold Standard pool was exhausted for a specific class without triggering PHI warnings.\n')

print('Batch 3 Plan Generated.')
