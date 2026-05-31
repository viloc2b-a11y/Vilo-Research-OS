import csv
import os
from collections import defaultdict

input_csv = 'validation-corpus/metadata/master-corpus-inventory.csv'
output_csv = 'validation-corpus/metadata/reader-gold-standard-candidates-v2.csv'
summary_md = 'validation-corpus/metadata/reader-gold-standard-summary-v2.md'

inventory = []
with open(input_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        inventory.append(row)

# Targets
targets = {
    'PROTOCOL': (8, 10),
    'AMENDMENT': (3, 5),
    'ECRF_GUIDE': (4, 6),
    'LAB_MANUAL': (3, 5),
    'PHARMACY_MANUAL': (2, 3),
    'SOURCE_TEMPLATE': (3, 5) # Map SOURCE_DOC to SOURCE_TEMPLATE if allowed
}

allowed_exts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.xlsm', '.csv']
disallowed_keywords = ['overview', 'slide', 'presentation', 'summary', 'deck']

def is_allowed(doc):
    ext = doc['Extension'].lower()
    if ext not in allowed_exts: return False
    fname = doc['FileName'].lower()
    for kw in disallowed_keywords:
        if kw in fname: return False
    
    # We want to treat some SOURCE_DOC as SOURCE_TEMPLATE if it's a blank template
    doc_class = doc['DocumentClass']
    if doc_class == 'SOURCE_DOC':
        if 'blank' in fname or 'template' in fname or 'worksheet' in fname:
            doc['DocumentClass'] = 'SOURCE_TEMPLATE'
            return True
        return False
        
    if doc_class not in targets: return False
    return True

pool = [d for d in inventory if is_allowed(d)]

# Sort by complexity / size to prioritize rich files
complexity_map = {'EXTREME': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
pool.sort(key=lambda x: (complexity_map.get(x['ProtocolComplexity'], 1), float(x['SizeMB'])), reverse=True)

selected = []
counts = defaultdict(int)

# Select TIER 1: Protocols / Amendments
for doc in list(pool):
    if doc['DocumentClass'] == 'PROTOCOL' and counts['PROTOCOL'] < targets['PROTOCOL'][1]:
        doc['PriorityTier'] = 'TIER_1'
        doc['SelectionReason'] = 'Core Protocol Analysis'
        selected.append(doc)
        counts['PROTOCOL'] += 1
        pool.remove(doc)
    elif doc['DocumentClass'] == 'AMENDMENT' and counts['AMENDMENT'] < targets['AMENDMENT'][1]:
        doc['PriorityTier'] = 'TIER_1'
        doc['SelectionReason'] = 'Amendment Delta Analysis'
        selected.append(doc)
        counts['AMENDMENT'] += 1
        pool.remove(doc)

# Select TIER 2: Manuals, eCRF, Source templates
for doc in list(pool):
    cls = doc['DocumentClass']
    if cls in ['ECRF_GUIDE', 'LAB_MANUAL', 'PHARMACY_MANUAL', 'SOURCE_TEMPLATE']:
        if counts[cls] < targets[cls][1]:
            doc['PriorityTier'] = 'TIER_2'
            doc['SelectionReason'] = 'Ancillary Dependency & Mapping'
            selected.append(doc)
            counts[cls] += 1
            pool.remove(doc)

# Backfill any missing quotas with what we have, maybe assign TIER_3 to excess or edge formats
for doc in list(pool):
    cls = doc['DocumentClass']
    if len(selected) < 35:
        if counts[cls] < targets[cls][1]: # Just in case
            doc['PriorityTier'] = 'TIER_3'
            doc['SelectionReason'] = 'Format Diversity & Edge Cases'
            selected.append(doc)
            counts[cls] += 1
            pool.remove(doc)

# Let's ensure we get at least some diversity in TIER 3 if we still have room
if len(selected) < 30:
    for doc in pool[:30 - len(selected)]:
        doc['PriorityTier'] = 'TIER_3'
        doc['SelectionReason'] = 'Format Diversity'
        selected.append(doc)

for idx, doc in enumerate(selected):
    doc['GoldID'] = f"GOLD_V2_{idx+1:03d}"

# Write CSV
with open(output_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'GoldID', 'CorpusID', 'OriginalPath', 'FileName', 'DocumentClass', 
        'StudyFamily', 'Extension', 'SizeMB', 'ProtocolComplexity', 
        'ContainsSOA', 'ContainsFootnotes', 'ContainsConditionalLogic', 
        'SelectionReason', 'PriorityTier'
    ])
    writer.writeheader()
    for doc in selected:
        writer.writerow({k: doc.get(k, '') for k in writer.fieldnames})

# Write MD
tier_counts = defaultdict(int)
for doc in selected: tier_counts[doc['PriorityTier']] += 1

with open(summary_md, 'w', encoding='utf-8') as f:
    f.write("# Reader Gold Standard Summary v2\n\n")
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
        
    f.write("\n### Coverage Gaps\n")
    if counts['PHARMACY_MANUAL'] == 0:
        f.write("- **Pharmacy Manuals:** Minimal to no raw pharmacy manuals were found in the accepted file formats.\n")
    if counts['LAB_MANUAL'] == 0:
        f.write("- **Lab Manuals:** Minimal to no raw lab manuals were found in the accepted file formats.\n")
        
    f.write("\n### Recommended Sanitization Batch 1\n")
    for doc in [d for d in selected if d['PriorityTier'] == 'TIER_1'][:5]:
        f.write(f"1. `{doc['OriginalPath']}` ({doc['DocumentClass']})\n")

print("V2 Gold standard selection completed.")
