import os
import shutil

inbox_dir = 'validation-corpus/inbox'
non_reader_dir = 'validation-corpus/non-reader-assets'
report_file = 'validation-corpus/metadata/inbox-cleanup-report.md'

categories = [
    'budgets', 'ctas', 'regulatory', 'training', 'siv', 
    'finance', 'correspondence', 'archives', 'site-operations', 'miscellaneous'
]

for cat in categories:
    os.makedirs(os.path.join(non_reader_dir, cat), exist_ok=True)

reader_keywords = [
    'protocol', 'amend', 'ecrf', 'crf', 'lab', 'pharmacy', 
    'imaging', 'source', 'manual', 'guideline', 'synopsis'
]

budget_keywords = ['budget', 'medicare', 'mca', 'coverage']
cta_keywords = ['cta', 'contract', 'agreement', 'cdb', 'cda', 'nda', 'mta']
regulatory_keywords = ['1572', 'irb', 'fdf', 'financial disclosure', 'cv', 'license', 'clia', 'cap', 'delegation', 'doa', 'log']
training_keywords = ['training', 'cert', 'gcp', 'iata', 'dangerous goods']
siv_keywords = ['siv', 'initiation', 'slides', 'deck']
finance_keywords = ['payment', 'invoice', 'w9', 'w-9', 'bank', 'remittance', 'finance', 'ledger']
correspondence_keywords = ['email', 'letter', 'memo', 'correspondence', 'communication', 'msg']
site_ops_keywords = ['monitor', 'cra', 'visit', 'imv', 'cov', 'mvr', 'newsletter', 'update', 'contact list', 'roster']

moved_counts = {cat: 0 for cat in categories}
retained_count = 0

moved_files = {cat: [] for cat in categories}
retained_files = []

for root, _, files in os.walk(inbox_dir):
    for filename in files:
        if filename in ['.gitkeep', '.gitignore']:
            continue
            
        full_path = os.path.join(root, filename)
        fname_lower = filename.lower()
        path_lower = full_path.lower()
        
        target_cat = None
        
        if fname_lower.endswith('.zip') or fname_lower.endswith('.rar') or fname_lower.endswith('.7z'):
            target_cat = 'archives'
        elif fname_lower.endswith('.eml') or fname_lower.endswith('.msg') or any(k in path_lower for k in correspondence_keywords):
            target_cat = 'correspondence'
        elif fname_lower.endswith('.pptx') or fname_lower.endswith('.ppt'):
            if any(k in path_lower for k in siv_keywords):
                target_cat = 'siv'
            elif any(k in path_lower for k in training_keywords):
                target_cat = 'training'
            else:
                target_cat = 'miscellaneous'
        elif any(k in path_lower for k in budget_keywords):
            target_cat = 'budgets'
        elif any(k in path_lower for k in cta_keywords):
            target_cat = 'ctas'
        elif any(k in path_lower for k in finance_keywords):
            target_cat = 'finance'
        elif any(k in path_lower for k in siv_keywords):
            target_cat = 'siv'
        elif any(k in path_lower for k in training_keywords):
            target_cat = 'training'
        elif any(k in path_lower for k in regulatory_keywords):
            target_cat = 'regulatory'
        elif any(k in path_lower for k in site_ops_keywords):
            target_cat = 'site-operations'
        else:
            # Check reader relevance
            is_reader = False
            for k in reader_keywords:
                if k in fname_lower or k in os.path.basename(root).lower():
                    is_reader = True
                    break
            if not is_reader:
                target_cat = 'miscellaneous'
                
        if target_cat:
            target_path = os.path.join(non_reader_dir, target_cat, filename)
            
            # Handle name collisions
            if os.path.exists(target_path):
                base, ext = os.path.splitext(filename)
                idx = 1
                while os.path.exists(os.path.join(non_reader_dir, target_cat, f"{base}_{idx}{ext}")):
                    idx += 1
                target_path = os.path.join(non_reader_dir, target_cat, f"{base}_{idx}{ext}")
                
            shutil.move(full_path, target_path)
            moved_counts[target_cat] += 1
            moved_files[target_cat].append(filename)
        else:
            retained_count += 1
            retained_files.append(full_path)

# Cleanup empty dirs
for root, dirs, _ in os.walk(inbox_dir, topdown=False):
    for d in dirs:
        dir_path = os.path.join(root, d)
        if not os.listdir(dir_path):
            os.rmdir(dir_path)

with open(report_file, 'w', encoding='utf-8') as f:
    f.write("# Inbox Cleanup Report\n\n")
    
    total_moved = sum(moved_counts.values())
    f.write(f"### Summary\n")
    f.write(f"- **Files Moved out of Inbox:** {total_moved}\n")
    f.write(f"- **Files Retained in Inbox:** {retained_count}\n\n")
    
    f.write("### Files Moved by Category\n")
    for cat in categories:
        f.write(f"- **{cat.capitalize()}:** {moved_counts[cat]}\n")
        
    f.write("\n### Recommended Future Corpus Opportunities\n")
    f.write("- **Budgets / CTAs:** Extract payment terms and study coverage rules using separate specialized pipelines.\n")
    f.write("- **Regulatory:** Map FDA 1572s and Delegation Logs to PI and sub-investigator tracking systems.\n")
    f.write("- **Site Operations:** Extract CRA findings from monitoring visit reports.\n")

print("Inbox Cleanup Completed.")
