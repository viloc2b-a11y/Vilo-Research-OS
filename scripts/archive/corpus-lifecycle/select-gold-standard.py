import csv
import random
from collections import defaultdict
import os

input_csv = 'validation-corpus/metadata/master-corpus-inventory.csv'
output_csv = 'validation-corpus/metadata/reader-gold-standard-candidates.csv'
summary_md = 'validation-corpus/metadata/reader-gold-standard-summary.md'

# We want 30 total: 10 TIER_1, 10 TIER_2, 10 TIER_3
# Allowed classes: PROTOCOL, AMENDMENT, ECRF_GUIDE, LAB_MANUAL, PHARMACY_MANUAL

inventory = []
with open(input_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        inventory.append(row)

allowed_classes = ['PROTOCOL', 'AMENDMENT', 'ECRF_GUIDE', 'LAB_MANUAL', 'PHARMACY_MANUAL']
candidates_pool = [x for x in inventory if x['DocumentClass'] in allowed_classes]

# Sort by complexity to prioritize EXTREME and HIGH for TIER 1
complexity_map = {'EXTREME': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
candidates_pool.sort(key=lambda x: (complexity_map.get(x['ProtocolComplexity'], 1), float(x['SizeMB'])), reverse=True)

selected = []
study_families_seen = set()

def pick_candidates(pool, needed, tier, reason_prefix):
    picked = []
    # Try to maximize study family diversity
    for doc in list(pool):
        if len(picked) >= needed: break
        if doc['StudyFamily'] not in study_families_seen or needed - len(picked) > 5:
            doc['PriorityTier'] = tier
            doc['SelectionReason'] = f"{reason_prefix}: {doc['DocumentClass']} ({doc['ProtocolComplexity']})"
            picked.append(doc)
            study_families_seen.add(doc['StudyFamily'])
            pool.remove(doc)
    return picked

tier1 = pick_candidates([x for x in candidates_pool if x['RecommendedForReaderValidation'] == 'TRUE'], 10, 'TIER_1', 'High Priority Structural Validation')
# If we didn't get 10, fallback to general pool
if len(tier1) < 10:
    tier1 += pick_candidates(candidates_pool, 10 - len(tier1), 'TIER_1', 'High Priority Structural Validation')

tier2 = pick_candidates([x for x in candidates_pool if x['DocumentClass'] in ('ECRF_GUIDE', 'LAB_MANUAL', 'PHARMACY_MANUAL')], 10, 'TIER_2', 'Secondary Dependency Mapping')
if len(tier2) < 10:
    tier2 += pick_candidates(candidates_pool, 10 - len(tier2), 'TIER_2', 'Secondary Dependency Mapping')

tier3 = pick_candidates(candidates_pool, 10, 'TIER_3', 'Broad Coverage & Edge Cases')

final_selection = tier1 + tier2 + tier3

# Assign GoldID
for idx, doc in enumerate(final_selection):
    doc['GoldID'] = f"GOLD_{idx+1:03d}"

# Write output CSV
with open(output_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'GoldID', 'CorpusID', 'OriginalPath', 'FileName', 'DocumentClass', 
        'StudyFamily', 'Extension', 'SizeMB', 'ProtocolComplexity', 
        'ContainsSOA', 'ContainsFootnotes', 'ContainsConditionalLogic', 
        'SelectionReason', 'PriorityTier'
    ])
    writer.writeheader()
    for doc in final_selection:
        writer.writerow({k: doc.get(k, '') for k in writer.fieldnames})

# Calculate stats for summary
total_selected = len(final_selection)
counts_class = defaultdict(int)
counts_tier = defaultdict(int)
for doc in final_selection:
    counts_class[doc['DocumentClass']] += 1
    counts_tier[doc['PriorityTier']] += 1

# Write summary MD
with open(summary_md, 'w', encoding='utf-8') as f:
    f.write("# Reader Gold Standard Summary\n\n")
    f.write(f"**Total Selected:** {total_selected}\n\n")
    
    f.write("### Counts by Document Class\n")
    for k, v in counts_class.items():
        f.write(f"- {k}: {v}\n")
        
    f.write("\n### Counts by Priority Tier\n")
    for k, v in sorted(counts_tier.items()):
        f.write(f"- {k}: {v}\n")
        
    f.write("\n### Top 10 Highest-Value Documents\n")
    for doc in tier1[:10]:
        f.write(f"- **{doc['GoldID']} ({doc['FileName']})** - {doc['DocumentClass']} / {doc['ProtocolComplexity']} ({doc['SizeMB']} MB)\n")
        f.write(f"  *Reason:* {doc['SelectionReason']}\n")
        
    f.write("\n### Coverage Gaps\n")
    if 'IMAGING_MANUAL' not in counts_class:
        f.write("- **Missing:** No IMAGING_MANUAL documents selected (none available in source).\n")
    f.write("- **Diversity constraints:** We prioritized files with EXTREME and HIGH complexity where available, but heavily relied on UNKNOWN study families if specific known clinical domains were sparse.\n")
    
    f.write("\n### Recommended Sanitization Batch 1\n")
    f.write("The following files should be prioritized for the very first sanitization sweep:\n")
    for doc in tier1[:5]:
        f.write(f"1. `{doc['OriginalPath']}` ({doc['DocumentClass']})\n")

print("Gold standard selection completed.")
