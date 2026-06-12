import csv
import os
import hashlib
from collections import defaultdict

master_csv = 'validation-corpus/metadata/master-corpus-inventory.csv'
v3_csv = 'validation-corpus/metadata/reader-gold-standard-candidates-v3.csv'
summary_md = 'validation-corpus/metadata/reader-gold-standard-summary-v3.md'
dups_md = 'validation-corpus/metadata/reader-gold-standard-duplicates.md'

# Read master inventory
inventory = []
with open(master_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        inventory.append(row)

# Hashing utility
def get_file_hash(filepath):
    h = hashlib.md5()
    try:
        with open(filepath, 'rb') as file:
            while chunk := file.read(8192):
                h.update(chunk)
        return h.hexdigest()
    except:
        return None

# Allowed rules
targets = {
    'PROTOCOL': 10,
    'AMENDMENT': 5,
    'ECRF_GUIDE': 6,
    'LAB_MANUAL': 5,
    'PHARMACY_MANUAL': 3,
    'SOURCE_TEMPLATE': 1 # To map SOURCE_DOC
}
allowed_exts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.xlsm', '.csv']
disallowed_keywords = ['overview', 'slide', 'presentation', 'summary', 'deck']

def is_allowed(doc):
    ext = doc['Extension'].lower()
    if ext not in allowed_exts: return False
    fname = doc['FileName'].lower()
    for kw in disallowed_keywords:
        if kw in fname: return False
    
    doc_class = doc['DocumentClass']
    if doc_class == 'SOURCE_DOC':
        if 'blank' in fname or 'template' in fname or 'worksheet' in fname:
            doc['DocumentClass'] = 'SOURCE_TEMPLATE'
            return True
        return False
        
    if doc_class not in targets: return False
    return True

# Filter pool
pool = [d for d in inventory if is_allowed(d)]
complexity_map = {'EXTREME': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
pool.sort(key=lambda x: (complexity_map.get(x['ProtocolComplexity'], 1), float(x['SizeMB'])), reverse=True)

selected = []
counts = defaultdict(int)

seen_hashes = {}
duplicates_report = []

for doc in list(pool):
    # Only pick if we need it
    cls = doc['DocumentClass']
    
    # Try to calculate hash
    fhash = get_file_hash(doc['OriginalPath'])
    if not fhash:
        fhash = f"{doc['SizeMB']}_{doc['FileName'].lower()}" # Fallback
        
    if fhash in seen_hashes:
        # It's a duplicate!
        canonical = seen_hashes[fhash]
        duplicates_report.append({
            'canonical': canonical['OriginalPath'],
            'duplicate': doc['OriginalPath'],
            'size': doc['SizeMB']
        })
        pool.remove(doc)
        continue
    
    if len(selected) < 30 and counts[cls] < targets[cls]:
        # Add to selected
        seen_hashes[fhash] = doc
        
        # Priority tier
        if cls in ['PROTOCOL', 'AMENDMENT']:
            doc['PriorityTier'] = 'TIER_1'
            doc['SelectionReason'] = 'Core Protocol Analysis'
        else:
            doc['PriorityTier'] = 'TIER_2'
            doc['SelectionReason'] = 'Ancillary Dependency Mapping'
            
        selected.append(doc)
        counts[cls] += 1
        pool.remove(doc)

# Backfill if we are under 30
if len(selected) < 30:
    for doc in list(pool):
        if len(selected) >= 30: break
        
        fhash = get_file_hash(doc['OriginalPath'])
        if not fhash: fhash = f"{doc['SizeMB']}_{doc['FileName'].lower()}"
        
        if fhash in seen_hashes:
            canonical = seen_hashes[fhash]
            duplicates_report.append({
                'canonical': canonical['OriginalPath'],
                'duplicate': doc['OriginalPath'],
                'size': doc['SizeMB']
            })
            continue
            
        # Prioritize Protocols over Amendments if backfilling
        cls = doc['DocumentClass']
        
        doc['PriorityTier'] = 'TIER_3'
        doc['SelectionReason'] = 'Format Diversity & Edge Cases'
        seen_hashes[fhash] = doc
        selected.append(doc)
        counts[cls] += 1

# Rename Gold IDs
for idx, doc in enumerate(selected):
    doc['GoldID'] = f"GOLD_V3_{idx+1:03d}"

# Write CSV
with open(v3_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'GoldID', 'CorpusID', 'OriginalPath', 'FileName', 'DocumentClass', 
        'StudyFamily', 'Extension', 'SizeMB', 'ProtocolComplexity', 
        'ContainsSOA', 'ContainsFootnotes', 'ContainsConditionalLogic', 
        'SelectionReason', 'PriorityTier'
    ])
    writer.writeheader()
    for doc in selected:
        writer.writerow({k: doc.get(k, '') for k in writer.fieldnames})

# Write Duplicates MD
with open(dups_md, 'w', encoding='utf-8') as f:
    f.write("# Gold Standard Duplicate Resolution Report\n\n")
    if not duplicates_report:
        f.write("No duplicates found during selection.\n")
    else:
        f.write("The following files were removed from selection consideration because their MD5 hash (or filename+size fallback) matched a higher-priority canonical file.\n\n")
        for dup in duplicates_report:
            f.write(f"- **Duplicate:** `{dup['duplicate']}` ({dup['size']} MB)\n")
            f.write(f"  **Canonical:** `{dup['canonical']}`\n\n")

# Write Summary MD
tier_counts = defaultdict(int)
for doc in selected: tier_counts[doc['PriorityTier']] += 1

with open(summary_md, 'w', encoding='utf-8') as f:
    f.write("# Reader Gold Standard Summary v3 (Deduplicated)\n\n")
    f.write(f"**Total Selected:** {len(selected)}\n\n")
    
    f.write("### Counts by Document Class\n")
    for k, v in counts.items():
        f.write(f"- {k}: {v}\n")
        
    f.write("\n### Counts by Priority Tier\n")
    for k, v in sorted(tier_counts.items()):
        f.write(f"- {k}: {v}\n")
        
    f.write("\n### Top 10 Highest-Value Documents\n")
    for doc in [d for d in selected if d['PriorityTier'] == 'TIER_1'][:10]:
        f.write(f"- **{doc['GoldID']} ({doc['FileName']})** - {doc['DocumentClass']} / {doc['ProtocolComplexity']} ({doc['SizeMB']} MB)\n")
        f.write(f"  *Reason:* {doc['SelectionReason']}\n")
        
    f.write("\n### Duplication Statistics\n")
    f.write(f"- Total duplicates avoided: {len(duplicates_report)}\n")
    f.write(f"- See `reader-gold-standard-duplicates.md` for full breakdown.\n")
    
    f.write("\n### Recommended Sanitization Batch 1\n")
    for doc in [d for d in selected if d['PriorityTier'] == 'TIER_1'][:5]:
        f.write(f"1. `{doc['OriginalPath']}` ({doc['DocumentClass']})\n")

print("V3 deduplication completed.")
