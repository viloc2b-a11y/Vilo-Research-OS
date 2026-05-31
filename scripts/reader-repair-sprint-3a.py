import os
import json
import sys

# Ensure lib is in path
sys.path.append(os.path.join(os.getcwd(), 'lib', 'protocol-intake', 'extractors'))
from native_reader import NativeTableReader

registry_file = 'validation-corpus/gold-standard/gold-standard-registry.json'
metadata_dir = 'validation-corpus/metadata'
report_path = os.path.join(metadata_dir, 'native-reader-contract-validation-report.md')

# Read registry
with open(registry_file, 'r', encoding='utf-8') as f:
    registry = json.load(f)

# Find 3 docs: 1 protocol, 1 amendment, 1 ecrf/manual
docs_to_test = []
classes_found = {'PROTOCOL': False, 'AMENDMENT': False, 'OTHER': False}

for d in registry.get('documents', []):
    if d.get('status') == 'SAFE_TEXT_EXTRACTED':
        sanitized_id = d['sanitized_id']
        cls = 'UNKNOWN'
        if 'PROTOCOL' in sanitized_id and 'AMEND' not in sanitized_id:
            cls = 'PROTOCOL'
        elif 'AMEND' in sanitized_id:
            cls = 'AMENDMENT'
        elif 'ECRF' in sanitized_id or 'LAB' in sanitized_id or 'PHARMACY' in sanitized_id:
            cls = 'OTHER'
            
        mf_path = os.path.join(metadata_dir, f"{sanitized_id}.mapping.json")
        if not os.path.exists(mf_path): continue
        with open(mf_path, 'r', encoding='utf-8') as f:
            mapping = json.load(f)
        orig_path = mapping.get('processed_original_path') or mapping.get('unsafe_binary_path')
        if not orig_path or not os.path.exists(orig_path): continue
        
        target = None
        if cls == 'PROTOCOL' and not classes_found['PROTOCOL']:
            target = 'PROTOCOL'
        elif cls == 'AMENDMENT' and not classes_found['AMENDMENT']:
            target = 'AMENDMENT'
        elif cls == 'OTHER' and not classes_found['OTHER']:
            target = 'OTHER'
            
        if target:
            classes_found[target] = True
            docs_to_test.append({
                'sanitized_id': sanitized_id,
                'class': cls,
                'path': orig_path
            })
            if all(classes_found.values()):
                break

if len(docs_to_test) < 3:
    print(f"Warning: Could not find exactly 1 of each class. Found {len(docs_to_test)}")

reader_val = NativeTableReader(mode='VALIDATION')
reader_prod = NativeTableReader(mode='PRODUCTION')

def check_leaks(text):
    if not text: return []
    leaks = []
    text_lower = text.lower()
    for kw in reader_val.phi_keywords:
        if kw.lower() in text_lower: leaks.append(f'PHI: {kw}')
    for kw in reader_val.sponsor_keywords:
        if kw.lower() in text_lower: leaks.append(f'Sponsor: {kw}')
    for kw in reader_val.compound_keywords:
        if kw.lower() in text_lower: leaks.append(f'Compound: {kw}')
    return leaks

results = []
metrics = {
    'total_docs': 0,
    'geometry_match': 0,
    'redaction_success': 0,
    'failures': 0
}

for doc in docs_to_test:
    sid = doc['sanitized_id']
    fpath = doc['path']
    metrics['total_docs'] += 1
    
    val_tables = reader_val.extract_tables(fpath, sid)
    prod_tables = reader_prod.extract_tables(fpath, sid)
    
    val_table_count = len(val_tables)
    prod_table_count = len(prod_tables)
    
    geometry_match = True
    redaction_successful = True
    leak_failed = False
    prod_preserved = False
    
    if val_table_count != prod_table_count:
        geometry_match = False
    else:
        for i in range(val_table_count):
            vt = val_tables[i]
            pt = prod_tables[i]
            if vt['row_count'] != pt['row_count'] or vt['column_count'] != pt['column_count']:
                geometry_match = False
            
            # Check cells
            if len(vt['cells']) != len(pt['cells']):
                geometry_match = False
            else:
                for c_idx in range(len(vt['cells'])):
                    vc = vt['cells'][c_idx]
                    pc = pt['cells'][c_idx]
                    if vc['row'] != pc['row'] or vc['col'] != pc['col']:
                        geometry_match = False
                    
                    if vc['text'] != pc['text']:
                        prod_preserved = True
                        
                    leaks = check_leaks(vc['text'])
                    if leaks:
                        leak_failed = True
                        
    if geometry_match:
        metrics['geometry_match'] += 1
    if not leak_failed:
        metrics['redaction_success'] += 1
    if leak_failed or not geometry_match:
        metrics['failures'] += 1
        
    results.append({
        'sanitized_id': sid,
        'val_tables': val_table_count,
        'prod_tables': prod_table_count,
        'geometry_match': geometry_match,
        'leak_safe': not leak_failed,
        'prod_preserved_identifiers': prod_preserved
    })

report_content = [
    "# Native Reader Contract Validation Report",
    "\n## Overview",
    "This report validates the mode-awareness and structural stability of the `NativeTableReader` class.",
    "\n## Documents Tested"
]
for d in docs_to_test:
    report_content.append(f"- **{d['sanitized_id']}** ({d['class']})")

report_content.append("\n## Results")
report_content.append("| Document | Validation Tables | Production Tables | Geometry Match | Validation Leaks Found | Prod Identifiers Preserved |")
report_content.append("|---|---|---|---|---|---|")

for r in results:
    match_str = "✅ YES" if r['geometry_match'] else "❌ NO"
    leak_str = "❌ YES" if not r['leak_safe'] else "✅ NO"
    prod_str = "✅ YES" if r['prod_preserved_identifiers'] else "⚠️ None found"
    report_content.append(f"| {r['sanitized_id']} | {r['val_tables']} | {r['prod_tables']} | {match_str} | {leak_str} | {prod_str} |")

report_content.append("\n## Summary")
report_content.append(f"- **Total Documents:** {metrics['total_docs']}")
report_content.append(f"- **Geometry Matches:** {metrics['geometry_match']}")
report_content.append(f"- **Redaction Successes:** {metrics['redaction_success']}")
report_content.append(f"- **Failures:** {metrics['failures']}")

report_content.append("\n## Readiness Assessment")
if metrics['failures'] == 0 and metrics['total_docs'] == 3:
    report_content.append("**STATUS: READY**")
    report_content.append("The canonical reader successfully enforces identity policies conditionally while maintaining mathematical structural equivalence.")
else:
    report_content.append("**STATUS: NOT READY**")
    report_content.append("The reader failed contract validation.")

with open(report_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_content))

print("Sprint 3A Validation Complete.")
