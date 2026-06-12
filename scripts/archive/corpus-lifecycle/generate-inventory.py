import os
import csv
import re

inbox_dir = 'validation-corpus/inbox'
csv_path = 'validation-corpus/metadata/master-corpus-inventory.csv'
md_path = 'validation-corpus/metadata/corpus-summary.md'

rows = []
counts = {
    'PROTOCOL': 0, 'AMENDMENT': 0, 'ECRF_GUIDE': 0, 'LAB_MANUAL': 0, 
    'PHARMACY_MANUAL': 0, 'IMAGING_MANUAL': 0, 'SOURCE_DOC': 0, 
    'SOURCE_TEMPLATE': 0, 'BUDGET': 0, 'CTA': 0, 'IRB': 0, 'SAFETY': 0, 
    'MONITORING': 0, 'TRAINING': 0, 'PATIENT_SPECIFIC': 0, 'OTHER': 0
}

corpus_id_counter = 1

def classify(filename):
    f = filename.lower()
    if 'budget' in f or 'payment' in f: return 'BUDGET'
    if 'agreement' in f or 'sow' in f or 'cta' in f or 'msa' in f or 'contract' in f: return 'CTA'
    if 'irb' in f or 'consent' in f or 'icf' in f: return 'IRB'
    if 'sae' in f or 'aesi' in f or 'safety' in f: return 'SAFETY'
    if 'monitor' in f or 'siv' in f or 'initiation' in f or 'close-out' in f or 'delegation' in f or 'essential' in f or 'inventory' in f: return 'MONITORING'
    if 'training' in f or 'guide' in f and 'ecrf' not in f and 'crf' not in f: return 'TRAINING'
    if 'patient' in f or 'subject' in f or 'worksheet' in f: return 'PATIENT_SPECIFIC'
    if 'lab' in f or 'specimen' in f or 'blood' in f or 'plasma' in f: return 'LAB_MANUAL'
    if 'pharmacy' in f or 'ip ' in f or 'dose' in f: return 'PHARMACY_MANUAL'
    if 'imaging' in f or 'mri' in f or 'x-ray' in f: return 'IMAGING_MANUAL'
    if 'ecrf' in f or 'crf completion' in f or 'ccg' in f or 'crf guidelines' in f or 'crf' in f or 'edc' in f: return 'ECRF_GUIDE'
    if 'source' in f and 'template' in f: return 'SOURCE_TEMPLATE'
    if 'source' in f: return 'SOURCE_DOC'
    if 'amend' in f: return 'AMENDMENT'
    if 'protocol' in f or 'synopsis' in f: return 'PROTOCOL'
    return 'OTHER'

def get_study_family(filename):
    f = filename.upper()
    if 'VALIDATION_PROTOCOL_001' in f or 'VALIDATION_PROTOCOL_001' in f: return 'VALIDATION_PROTOCOL_001'
    if 'VALIDATION_PROTOCOL_002' in f: return 'VALIDATION_PROTOCOL_002'
    if 'MRNA-1647-P301' in f: return 'mRNA-1647-P301'
    if 'IMVT-1401' in f: return 'IMVT-1401'
    if 'CRSPTL-00101' in f: return 'CRSPTL-00101'
    if 'UDX' in f: return 'UDX'
    return 'UNKNOWN'

for root, dirs, files in os.walk(inbox_dir):
    for filename in files:
        filepath = os.path.join(root, filename)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        ext = os.path.splitext(filename)[1].lower()
        
        doc_class = classify(filename)
        counts[doc_class] += 1
        
        study_family = get_study_family(filename)
        
        # Complexity logic
        complexity = 'LOW'
        soa = 'FALSE'
        footnotes = 'FALSE'
        cond_logic = 'FALSE'
        rec_reader = 'FALSE'
        
        if doc_class in ['PROTOCOL', 'AMENDMENT']:
            soa = 'TRUE'
            cond_logic = 'TRUE'
            footnotes = 'TRUE'
            rec_reader = 'TRUE'
            if size_mb > 5: complexity = 'EXTREME'
            elif size_mb > 2: complexity = 'HIGH'
            else: complexity = 'MEDIUM'
        elif doc_class == 'ECRF_GUIDE':
            cond_logic = 'TRUE'
            if size_mb > 5: complexity = 'HIGH'
            else: complexity = 'MEDIUM'
        elif doc_class in ['LAB_MANUAL', 'PHARMACY_MANUAL', 'IMAGING_MANUAL']:
            complexity = 'MEDIUM'
            
        corpus_id = f"VC_{corpus_id_counter:04d}"
        corpus_id_counter += 1
        
        rows.append({
            'CorpusID': corpus_id,
            'OriginalPath': filepath.replace('\\\\', '/'),
            'FileName': filename,
            'Extension': ext,
            'SizeMB': f"{size_mb:.2f}",
            'DocumentClass': doc_class,
            'StudyFamily': study_family,
            'ProtocolComplexity': complexity,
            'ContainsSOA': soa,
            'ContainsFootnotes': footnotes,
            'ContainsConditionalLogic': cond_logic,
            'RecommendedForReaderValidation': rec_reader
        })

# Write CSV
os.makedirs(os.path.dirname(csv_path), exist_ok=True)
with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'CorpusID', 'OriginalPath', 'FileName', 'Extension', 'SizeMB',
        'DocumentClass', 'StudyFamily', 'ProtocolComplexity',
        'ContainsSOA', 'ContainsFootnotes', 'ContainsConditionalLogic',
        'RecommendedForReaderValidation'
    ])
    writer.writeheader()
    writer.writerows(rows)

# Write MD
with open(md_path, 'w', encoding='utf-8') as f:
    f.write("# Master Corpus Classification Summary\n\n")
    f.write("Generated from recursive scan of `validation-corpus/inbox`.\n\n")
    f.write("| Document Class | Count |\n")
    f.write("|---|---|\n")
    for k, v in sorted(counts.items(), key=lambda item: item[1], reverse=True):
        f.write(f"| {k} | {v} |\n")
        
print("Successfully generated inventory.")
