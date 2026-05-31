import csv
import re
from collections import defaultdict

input_csv = 'validation-corpus/metadata/reader-gold-standard-candidates-v3.csv'
output_csv = 'validation-corpus/metadata/sanitization-plan-v1.csv'
summary_md = 'validation-corpus/metadata/sanitization-plan-v1.md'

inventory = []
with open(input_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        inventory.append(row)

# Risk checks based on path/filename
phi_keywords = ['zepeda', 'boynton', 'ojeas', 'missy'] # from earlier corpus inventory observation
sponsor_keywords = ['abbvie', 'abbott', 'acasti', 'allergan', 'gilead', 'paradigm', 'adamis']
study_keywords = ['para-oa', 'para_oa', 'mrna-1647', 'imvt-1401', 'crsptl', 'm16-066', 'm14-533', 'udx']

def get_risk_flags(path, fname):
    text = (path + ' ' + fname).lower()
    flags = []
    for p in phi_keywords:
        if p in text: flags.append('PHI_STAFF_OR_SITE')
    for s in sponsor_keywords:
        if s in text: flags.append('SPONSOR_NAME')
    for s in study_keywords:
        if s in text: flags.append('PROTOCOL_NUMBER')
    if 'site' in text and re.search(r'site\s*[0-9]+', text):
        flags.append('SITE_NUMBER')
    return '|'.join(flags) if flags else 'NONE'

# Counters for IDs
id_counters = {
    'PROTOCOL': 3, # Starting from A003
    'AMENDMENT': 1,
    'ECRF_GUIDE': 1,
    'LAB_MANUAL': 1,
    'PHARMACY_MANUAL': 1,
    'SOURCE_TEMPLATE': 1
}

# Grouping for amendments mapping to protocols
study_to_protocol_id = {}

for doc in inventory:
    path = doc['OriginalPath']
    fname = doc['FileName']
    cls = doc['DocumentClass']
    study = doc['StudyFamily']
    ext = doc['Extension']
    
    flags = get_risk_flags(path, fname)
    doc['RiskFlags'] = flags
    
    if 'PHI_STAFF_OR_SITE' in flags:
        status = 'NEEDS_MANUAL_REVIEW'
    else:
        status = 'SANITIZATION_READY'
        
    doc['SanitizationStatus'] = status
    
    sanitized_id = ''
    if cls == 'PROTOCOL':
        p_num = id_counters['PROTOCOL']
        sanitized_id = f"PROTOCOL_A{p_num:03d}"
        if study != 'UNKNOWN':
            study_to_protocol_id[study] = sanitized_id
        id_counters['PROTOCOL'] += 1
    elif cls == 'AMENDMENT':
        # Try to link to protocol
        base_id = study_to_protocol_id.get(study)
        if not base_id:
            # Create a base protocol ID for this amendment
            p_num = id_counters['PROTOCOL']
            base_id = f"PROTOCOL_A{p_num:03d}"
            if study != 'UNKNOWN':
                study_to_protocol_id[study] = base_id
            id_counters['PROTOCOL'] += 1
        
        # Check amendment counter for this protocol
        a_num = id_counters['AMENDMENT']
        sanitized_id = f"{base_id}_AMEND_{a_num:03d}"
        id_counters['AMENDMENT'] += 1
    else:
        num = id_counters.get(cls, 1)
        sanitized_id = f"{cls}_A{num:03d}"
        id_counters[cls] = num + 1
        
    doc['ProposedSanitizedID'] = sanitized_id
    
    # Path logic
    folder_map = {
        'PROTOCOL': 'protocols',
        'AMENDMENT': 'protocols',
        'ECRF_GUIDE': 'ecrf-guides',
        'LAB_MANUAL': 'lab-manuals',
        'PHARMACY_MANUAL': 'pharmacy-manuals',
        'SOURCE_TEMPLATE': 'source-guides'
    }
    
    folder = folder_map.get(cls, 'misc')
    doc['ProposedSanitizedPath'] = f"validation-corpus/sanitized/{folder}/{sanitized_id}{ext}"
    doc['BatchRecommendation'] = ''
    doc['Notes'] = f"Original size: {doc['SizeMB']} MB"

# Recommend Batch 1
batch1_targets = {
    'PROTOCOL': 3,
    'AMENDMENT': 1,
    'ECRF_GUIDE': 1,
    'LAB_MANUAL': 1,
    'PHARMACY_MANUAL': 1
}

batch1_count = 0
for doc in inventory:
    if doc['SanitizationStatus'] == 'SANITIZATION_READY':
        cls = doc['DocumentClass']
        if batch1_targets.get(cls, 0) > 0:
            doc['BatchRecommendation'] = 'BATCH_1'
            batch1_targets[cls] -= 1
            batch1_count += 1
            if batch1_count >= 7: break

# Write output CSV
with open(output_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'GoldID', 'CorpusID', 'OriginalPath', 'FileName', 'DocumentClass', 
        'ProposedSanitizedID', 'ProposedSanitizedPath', 'RiskFlags', 
        'SanitizationStatus', 'BatchRecommendation', 'Notes'
    ])
    writer.writeheader()
    for doc in inventory:
        writer.writerow({k: doc.get(k, '') for k in writer.fieldnames})

# Write summary MD
counts_status = defaultdict(int)
counts_flags = defaultdict(int)

for doc in inventory:
    counts_status[doc['SanitizationStatus']] += 1
    if doc['RiskFlags'] != 'NONE':
        for f in doc['RiskFlags'].split('|'):
            counts_flags[f] += 1

with open(summary_md, 'w', encoding='utf-8') as f:
    f.write("# Sanitization Plan v1\n\n")
    f.write(f"**Total Candidates Reviewed:** {len(inventory)}\n")
    f.write(f"**Candidates Ready:** {counts_status['SANITIZATION_READY']}\n")
    f.write(f"**Needing Manual Review:** {counts_status['NEEDS_MANUAL_REVIEW']}\n")
    f.write(f"**Excluded Candidates:** {counts_status['EXCLUDE_FROM_GOLD_STANDARD']}\n\n")
    
    f.write("### Risk Flags Identified\n")
    if not counts_flags:
        f.write("No obvious risks detected.\n")
    else:
        for k, v in counts_flags.items():
            f.write(f"- {k}: {v}\n")
            
    f.write("\n### Recommended Batch 1\n")
    batch1 = [d for d in inventory if d['BatchRecommendation'] == 'BATCH_1']
    for doc in batch1:
        f.write(f"- **{doc['ProposedSanitizedID']}** ({doc['DocumentClass']})\n")
        f.write(f"  - Original: `{doc['FileName']}`\n")
        f.write(f"  - Target: `{doc['ProposedSanitizedPath']}`\n")
    
    f.write("\n### Risk Notes\n")
    f.write("- **Protocol Numbers & Sponsor Names:** Heavily present across filenames and paths. Standard procedure is to replace all instances in the document text with the `ProposedSanitizedID` or `[SPONSOR]` tags.\n")
    f.write("- **Site/Staff PHI:** A few paths contain names associated with site staff or PI folders. These have been marked for manual review before entering the pipeline.\n")

print("Sanitization plan completed.")
