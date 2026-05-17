/**
 * Phase 6B.1B — Coordinator quick-pick pathology + medication catalog (bulk).
 * Source of truth for fixture generation and idempotent DB seed.
 */

function term(
  id,
  system,
  common_name,
  medical_name,
  icd10_code,
  synonyms,
  chronic_acute = 'Chronic',
  sex_specific = 'Both',
  pediatric_use = true,
) {
  const syn = Array.isArray(synonyms) ? synonyms.join(', ') : synonyms
  return {
    external_seed_id: id,
    system,
    common_name,
    medical_name,
    icd10_code,
    synonyms: syn,
    chronic_acute,
    sex_specific,
    pediatric_use,
    active_flag: true,
  }
}

function med(
  id,
  medication_name,
  brand_name,
  drug_class,
  route = 'oral',
  dosage_form = 'tablet',
) {
  return {
    external_seed_id: id,
    medication_name,
    brand_name,
    drug_class,
    route,
    dosage_form,
    active_flag: true,
  }
}

/** @returns {import('./patient-library-bulk-data.mjs').PathologyTerm[]} */
export function buildPathologyTerms() {
  const t = []
  let id = 1

  const add = (...args) => {
    t.push(term(id++, ...args))
  }

  // --- Required minimum + cardiovascular ---
  add('Cardiovascular', 'Hypertension', 'Essential hypertension', 'I10', [
    'HTN',
    'high blood pressure',
    'hypertension',
    'elevated BP',
  ])
  add('Cardiovascular', 'Hypotension', 'Hypotension, unspecified', 'I95.9', ['Low blood pressure', 'low BP'])
  add('Cardiovascular', 'Atrial fibrillation', 'Unspecified atrial fibrillation', 'I48.91', [
    'AFib',
    'A-fib',
    'AF',
    'irregular heartbeat',
  ])
  add('Cardiovascular', 'Coronary artery disease', 'Atherosclerotic heart disease of native coronary artery', 'I25.10', [
    'CAD',
    'CHD',
  ])
  add('Cardiovascular', 'Heart failure', 'Heart failure, unspecified', 'I50.9', ['CHF', 'congestive heart failure'])
  add('Cardiovascular', 'Hyperlipidemia', 'Hyperlipidemia, unspecified', 'E78.5', ['High cholesterol', 'dyslipidemia'])
  add('Cardiovascular', 'Angina', 'Angina pectoris, unspecified', 'I20.9', ['Chest pain', 'angina pectoris'])
  add('Cardiovascular', 'History of MI', 'Old myocardial infarction', 'I25.2', ['Prior heart attack', 'previous MI'])
  add('Cardiovascular', 'Peripheral artery disease', 'Peripheral vascular disease, unspecified', 'I73.9', ['PAD', 'PVD'])
  add('Cardiovascular', 'DVT', 'Acute embolism and thrombosis of unspecified deep veins', 'I82.40', [
    'Deep vein thrombosis',
    'blood clot leg',
  ])
  add('Cardiovascular', 'Pulmonary embolism', 'Pulmonary embolism without acute cor pulmonale', 'I26.99', ['PE', 'lung clot'])
  add('Cardiovascular', 'Stroke', 'Cerebral infarction, unspecified', 'I63.9', ['CVA', 'brain attack'])
  add('Cardiovascular', 'TIA', 'Transient cerebral ischemic attack, unspecified', 'G45.9', [
    'Transient ischemic attack',
    'mini-stroke',
  ])
  add('Cardiovascular', 'Varicose veins', 'Varicose veins of lower extremity', 'I83.10', ['Varicose veins'])
  add('Cardiovascular', 'Cardiac arrhythmia', 'Cardiac arrhythmia, unspecified', 'I49.9', ['Arrhythmia'])

  // Respiratory
  add('Respiratory', 'Asthma', 'Asthma, unspecified', 'J45.909', ['Bronchial asthma'])
  add('Respiratory', 'COPD', 'Chronic obstructive pulmonary disease, unspecified', 'J44.9', [
    'Chronic obstructive lung disease',
    'emphysema',
  ])
  add('Respiratory', 'Chronic bronchitis', 'Simple chronic bronchitis', 'J41.0', ['Bronchitis'])
  add('Respiratory', 'Sleep apnea', 'Obstructive sleep apnea', 'G47.33', ['OSA', 'sleep apnoea'])
  add('Respiratory', 'Pneumonia history', 'Pneumonia, unspecified organism', 'J18.9', ['Lung infection'])
  add('Respiratory', 'Allergic rhinitis', 'Allergic rhinitis, unspecified', 'J30.9', ['Hay fever', 'nasal allergies'])
  add('Respiratory', 'Pulmonary fibrosis', 'Unspecified pulmonary fibrosis', 'J84.10', ['Lung fibrosis'])
  add('Respiratory', 'Bronchiectasis', 'Bronchiectasis, uncomplicated', 'J47.9', ['Bronchiectasis'])

  // Endocrine / metabolic
  add('Endocrine', 'Diabetes', 'Diabetes mellitus, unspecified', 'E11.8', ['DM', 'diabetes mellitus'])
  add('Endocrine', 'Type 2 diabetes', 'Type 2 diabetes mellitus without complications', 'E11.9', [
    'T2DM',
    'diabetes mellitus type 2',
  ])
  add('Endocrine', 'Type 1 diabetes', 'Type 1 diabetes mellitus without complications', 'E10.9', ['T1DM', 'IDDM'])
  add('Endocrine', 'Prediabetes', 'Prediabetes', 'R73.03', ['Impaired glucose tolerance', 'IGT'])
  add('Endocrine', 'Hypothyroidism', 'Hypothyroidism, unspecified', 'E03.9', ['Underactive thyroid', 'low thyroid'])
  add('Endocrine', 'Hyperthyroidism', 'Hyperthyroidism, unspecified', 'E05.90', ['Overactive thyroid', 'Graves disease'])
  add('Endocrine', 'Obesity', 'Obesity, unspecified', 'E66.9', ['Overweight'])
  add('Endocrine', 'Metabolic syndrome', 'Metabolic syndrome', 'E88.81', ['MetS'])
  add('Endocrine', 'Vitamin D deficiency', 'Vitamin D deficiency, unspecified', 'E55.9', ['Low vitamin D'])
  add('Endocrine', 'Gout', 'Gout, unspecified', 'M10.9', ['Hyperuricemia', 'gouty arthritis'])

  // Digestive
  add('Digestive', 'GERD', 'Gastro-esophageal reflux disease without esophagitis', 'K21.9', [
    'Acid reflux',
    'heartburn',
    'reflux',
  ])
  add('Digestive', 'Peptic ulcer disease', 'Peptic ulcer, site unspecified', 'K27.9', ['Stomach ulcer', 'PUD'])
  add('Digestive', 'Irritable bowel syndrome', 'Irritable bowel syndrome, unspecified', 'K58.9', ['IBS'])
  add('Digestive', 'Crohn disease', "Crohn's disease, unspecified", 'K50.90', ['Crohns', 'IBD'])
  add('Digestive', 'Ulcerative colitis', 'Ulcerative colitis, unspecified', 'K51.90', ['UC', 'IBD'])
  add('Digestive', 'Diverticulosis', 'Diverticulosis of intestine', 'K57.90', ['Diverticulitis history'])
  add('Digestive', 'Fatty liver', 'Nonalcoholic fatty liver disease', 'K76.0', ['NAFLD', 'NASH'])
  add('Digestive', 'Gallstones', 'Calculus of gallbladder without cholecystitis', 'K80.20', ['Cholelithiasis'])
  add('Digestive', 'Pancreatitis history', 'Chronic pancreatitis, unspecified', 'K86.1', ['Pancreatitis'])
  add('Digestive', 'Celiac disease', 'Celiac disease', 'K90.0', ['Gluten sensitivity', 'coeliac'])

  // Musculoskeletal
  add('Musculoskeletal', 'Osteoarthritis', 'Osteoarthritis, unspecified site', 'M19.90', ['Arthritis', 'OA'])
  add('Musculoskeletal', 'Rheumatoid arthritis', 'Rheumatoid arthritis, unspecified', 'M06.9', ['RA'])
  add('Musculoskeletal', 'Osteoporosis', 'Osteoporosis, unspecified', 'M81.0', ['Low bone density', 'thin bones'])
  add('Musculoskeletal', 'Low back pain', 'Low back pain, unspecified', 'M54.50', ['Back pain', 'lumbago'])
  add('Musculoskeletal', 'Fibromyalgia', 'Fibromyalgia', 'M79.7', ['Fibromyalgia syndrome'])
  add('Musculoskeletal', 'Gout', 'Gout, unspecified', 'M10.9', ['Gouty arthritis'], 'Chronic')
  add('Musculoskeletal', 'Sciatica', 'Sciatica, unspecified side', 'M54.30', ['Sciatic pain'])
  add('Musculoskeletal', 'Carpal tunnel syndrome', 'Carpal tunnel syndrome, unspecified arm', 'G56.00', ['CTS'])
  add('Musculoskeletal', 'Rotator cuff tear', 'Unspecified rotator cuff tear', 'M75.100', ['Shoulder tear'])

  // Mental / behavioral
  add('Mental', 'Depression', 'Major depressive disorder, single episode, unspecified', 'F32.9', [
    'Depression',
    'MDD',
  ])
  add('Mental', 'Anxiety', 'Anxiety disorder, unspecified', 'F41.9', ['Generalized anxiety', 'GAD', 'anxious'])
  add('Mental', 'PTSD', 'Post-traumatic stress disorder, unspecified', 'F43.10', [
    'Post traumatic stress',
    'post-traumatic stress',
  ])
  add('Mental', 'ADHD', 'Attention-deficit hyperactivity disorder, unspecified type', 'F90.9', [
    'ADD',
    'attention deficit',
  ])
  add('Mental', 'Bipolar disorder', 'Bipolar disorder, unspecified', 'F31.9', ['Manic depression'])
  add('Mental', 'Insomnia', 'Insomnia, unspecified', 'G47.00', ['Sleep difficulty', 'trouble sleeping'])
  add('Mental', 'Panic disorder', 'Panic disorder', 'F41.0', ['Panic attacks'])
  add('Mental', 'OCD', 'Obsessive-compulsive disorder, unspecified', 'F42.9', ['Obsessive compulsive disorder'])
  add('Mental', 'Substance use disorder', 'Substance use disorder, unspecified, uncomplicated', 'F19.10', [
    'Drug abuse',
    'alcohol use disorder',
  ])

  // Nervous system
  add('Nervous system', 'Headache', 'Headache, unspecified', 'R51.9', ['Head pain', 'cephalalgia'])
  add('Nervous system', 'Migraine', 'Migraine, unspecified, not intractable', 'G43.909', [
    'Migraine headache',
    'migraines',
  ])
  add('Nervous system', 'Epilepsy', 'Epilepsy, unspecified', 'G40.909', ['Seizure disorder', 'seizures'])
  add('Nervous system', 'Neuropathy', 'Polyneuropathy, unspecified', 'G62.9', ['Peripheral neuropathy', 'nerve pain'])
  add('Nervous system', 'Parkinson disease', "Parkinson's disease", 'G20', ['Parkinsons'])
  add('Nervous system', 'Multiple sclerosis', 'Multiple sclerosis, unspecified', 'G35', ['MS'])
  add('Nervous system', 'Dementia', 'Dementia, unspecified', 'F03.90', ['Memory loss', 'cognitive decline'])
  add('Nervous system', 'Bell palsy history', "Bell's palsy", 'G51.0', ['Facial palsy'])

  // Eye
  add('Eye', 'Cataract', 'Unspecified cataract', 'H26.9', ['Lens opacity'])
  add('Eye', 'Glaucoma', 'Glaucoma, unspecified', 'H40.9', ['High eye pressure', 'open angle glaucoma'])
  add('Eye', 'Dry eye', 'Dry eye syndrome of unspecified lacrimal gland', 'H04.129', [
    'Dry eyes',
    'keratoconjunctivitis sicca',
  ])
  add('Eye', 'Macular degeneration', 'Unspecified macular degeneration', 'H35.30', ['AMD', 'age-related macular degeneration'])
  add('Eye', 'Diabetic retinopathy', 'Unspecified diabetic retinopathy', 'E11.319', ['Retinopathy'])

  // Ear / ENT
  add('Ear / ENT', 'Hearing loss', 'Unspecified hearing loss, bilateral', 'H91.93', ['Deafness', 'hard of hearing'])
  add('Ear / ENT', 'Tinnitus', 'Tinnitus, unspecified ear', 'H93.19', ['Ringing in ears'])
  add('Ear / ENT', 'Sinusitis', 'Chronic sinusitis, unspecified', 'J32.9', ['Chronic sinus disease'])
  add('Ear / ENT', 'Vertigo', 'Vertigo, unspecified', 'R42', ['Dizziness', 'BPPV'])

  // Infectious
  add('Infectious', 'Hepatitis B', 'Chronic viral hepatitis B without delta-agent', 'B18.1', ['HBV', 'hep B'])
  add('Infectious', 'Hepatitis C', 'Chronic viral hepatitis C', 'B18.2', ['HCV', 'hep C'])
  add('Infectious', 'HIV infection', 'Human immunodeficiency virus disease, unspecified', 'B20', ['HIV', 'AIDS history'])
  add('Infectious', 'COVID-19 history', 'Personal history of COVID-19', 'Z86.16', ['Coronavirus', 'SARS-CoV-2'])
  add('Infectious', 'Tuberculosis history', 'Personal history of tuberculosis', 'Z86.11', ['TB history'])
  add('Infectious', 'Herpes simplex', 'Herpesviral infection, unspecified', 'B00.9', ['HSV', 'cold sores'])
  add('Infectious', 'Urinary tract infection history', 'Personal history of urinary tract infection', 'Z87.440', [
    'Recurrent UTI',
  ])

  // Neoplasms
  add('Neoplasms', 'Breast cancer', 'Malignant neoplasm of unspecified site of breast', 'C50.919', [
    'Breast malignancy',
    'breast CA',
  ])
  add('Neoplasms', 'Lung cancer', 'Malignant neoplasm of bronchus or lung, unspecified', 'C34.90', ['Lung malignancy'])
  add('Neoplasms', 'Colon cancer', 'Malignant neoplasm of colon, unspecified', 'C18.9', ['Colorectal cancer', 'bowel cancer'])
  add('Neoplasms', 'Prostate cancer', 'Malignant neoplasm of prostate', 'C61', ['Prostate malignancy'])
  add('Neoplasms', 'Skin cancer history', 'Personal history of malignant neoplasm of skin', 'Z85.828', [
    'Melanoma history',
    'BCC history',
  ])
  add('Neoplasms', 'Thyroid cancer history', 'Personal history of malignant neoplasm of thyroid', 'Z85.850', [
    'Thyroid malignancy',
  ])

  // Genitourinary
  add('Genitourinary', 'UTI', 'Urinary tract infection, site not specified', 'N39.0', [
    'Urinary tract infection',
    'bladder infection',
  ])
  add('Genitourinary', 'CKD', 'Chronic kidney disease, unspecified', 'N18.9', [
    'Chronic renal disease',
    'kidney disease',
    'renal insufficiency',
  ])
  add('Genitourinary', 'Kidney stones', 'Calculus of kidney', 'N20.0', ['Nephrolithiasis', 'renal stones'])
  add('Genitourinary', 'Benign prostatic hyperplasia', 'Benign prostatic hyperplasia without LUTS', 'N40.0', ['BPH', 'enlarged prostate'])
  add('Genitourinary', 'Overactive bladder', 'Overactive bladder', 'N32.81', ['OAB', 'urinary urgency'])
  add('Genitourinary', 'Endometriosis', 'Endometriosis, unspecified', 'N80.9', ['Endometriosis'])
  add('Genitourinary', 'Polycystic ovary syndrome', 'Polycystic ovarian syndrome', 'E28.2', ['PCOS'])

  // Pregnancy
  add('Pregnancy', 'Pregnancy', 'Pregnant state, incidental', 'Z33.1', ['Pregnant', 'current pregnancy'], 'Both', 'Female', false)
  add('Pregnancy', 'Preeclampsia', 'Preeclampsia, unspecified', 'O14.9', ['Pre-eclampsia', 'toxemia'], 'Acute', 'Female', false)
  add('Pregnancy', 'Gestational diabetes', 'Gestational diabetes mellitus in pregnancy, unspecified', 'O24.419', [
    'GDM',
  ], 'Acute', 'Female', false)
  add('Pregnancy', 'History of cesarean section', 'Personal history of cesarean delivery', 'Z98.891', ['Prior C-section'], 'Chronic', 'Female', false)

  // Skin
  add('Skin', 'Eczema', 'Atopic dermatitis, unspecified', 'L20.9', ['Atopic dermatitis', 'dermatitis'])
  add('Skin', 'Psoriasis', 'Psoriasis, unspecified', 'L40.9', ['Plaque psoriasis'])
  add('Skin', 'Acne', 'Acne, unspecified', 'L70.9', ['Acne vulgaris'])
  add('Skin', 'Rosacea', 'Rosacea, unspecified', 'L71.9', ['Rosacea'])
  add('Skin', 'Cellulitis history', 'Personal history of cellulitis', 'Z87.2', ['Skin infection history'])

  // Blood / immune
  add('Blood and immune', 'Anemia', 'Anemia, unspecified', 'D64.9', ['Low hemoglobin', 'low blood count'])
  add('Blood and immune', 'Iron deficiency', 'Iron deficiency anemia, unspecified', 'D50.9', ['Low iron'])
  add('Blood and immune', 'Thyroiditis', 'Thyroiditis, unspecified', 'E06.9', ['Hashimoto thyroiditis'])
  add('Blood and immune', 'Lupus', 'Systemic lupus erythematosus, unspecified', 'M32.9', ['SLE', 'lupus erythematosus'])
  add('Blood and immune', 'Allergies', 'Allergy, unspecified', 'T78.40', ['Drug allergy', 'environmental allergies'], 'Both')

  // Symptoms / signs
  add('Symptoms and signs', 'Fatigue', 'Malaise and fatigue', 'R53.83', ['Tiredness', 'exhaustion'], 'Both')
  add('Symptoms and signs', 'Chest pain', 'Chest pain, unspecified', 'R07.9', ['Chest discomfort'], 'Both')
  add('Symptoms and signs', 'Shortness of breath', 'Dyspnea, unspecified', 'R06.00', ['SOB', 'dyspnea'], 'Both')
  add('Symptoms and signs', 'Edema', 'Localized edema', 'R60.0', ['Swelling', 'fluid retention'], 'Both')
  add('Symptoms and signs', 'Fever history', 'Fever, unspecified', 'R50.9', ['Pyrexia'], 'Acute')

  // Risk factors / history
  add('Medical history / risk factors', 'Tobacco use', 'Nicotine dependence, unspecified', 'F17.200', [
    'Smoking',
    'cigarette use',
    'former smoker',
  ])
  add('Medical history / risk factors', 'Alcohol use', 'Alcohol use, unspecified', 'F10.99', ['ETOH use'])
  add('Medical history / risk factors', 'Family history of heart disease', 'Family history of ischemic heart disease', 'Z82.49', [
    'FHx CAD',
  ])
  add('Medical history / risk factors', 'Fall risk', 'History of falling', 'Z91.81', ['Falls', 'recurrent falls'])

  // Congenital
  add('Congenital', 'Congenital heart disease', 'Congenital malformation of heart, unspecified', 'Q24.9', ['CHD'])
  add('Congenital', 'Down syndrome', 'Down syndrome, unspecified', 'Q90.9', ['Trisomy 21'], 'Chronic', 'Both', true)

  // Deduplicate by common_name + icd10 (keep first)
  const seen = new Set()
  const out = []
  for (const row of t) {
    const key = `${row.common_name.toLowerCase().trim()}|${(row.icd10_code ?? '').toLowerCase().trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out.map((row, idx) => ({ ...row, external_seed_id: 10000 + idx + 1 }))
}

/** @returns {ReturnType<typeof med>[]} */
export function buildMedicationTerms() {
  const m = []
  let id = 1
  const add = (...args) => {
    m.push(med(id++, ...args))
  }

  // Required minimum
  add('Metformin', 'Glucophage', 'Biguanide antidiabetic')
  add('Lisinopril', 'Prinivil', 'ACE inhibitor')
  add('Amlodipine', 'Norvasc', 'Calcium channel blocker')
  add('Losartan', 'Cozaar', 'Angiotensin II receptor blocker')
  add('Hydrochlorothiazide', 'Microzide', 'Thiazide diuretic')
  add('Atorvastatin', 'Lipitor', 'HMG-CoA reductase inhibitor')
  add('Simvastatin', 'Zocor', 'HMG-CoA reductase inhibitor')
  add('Levothyroxine', 'Synthroid', 'Thyroid hormone')
  add('Albuterol', 'ProAir', 'Short-acting beta agonist', 'inhalation', 'inhaler')
  add('Budesonide', 'Pulmicort', 'Inhaled corticosteroid', 'inhalation', 'inhaler')
  add('Fluticasone', 'Flovent', 'Inhaled corticosteroid', 'inhalation', 'inhaler')
  add('Sertraline', 'Zoloft', 'SSRI')
  add('Fluoxetine', 'Prozac', 'SSRI')
  add('Escitalopram', 'Lexapro', 'SSRI')
  add('Omeprazole', 'Prilosec', 'Proton pump inhibitor')
  add('Pantoprazole', 'Protonix', 'Proton pump inhibitor')
  add('Ibuprofen', 'Advil', 'NSAID')
  add('Acetaminophen', 'Tylenol', 'Analgesic')
  add('Prednisone', 'Deltasone', 'Corticosteroid')
  add('Amoxicillin', 'Amoxil', 'Penicillin antibiotic', 'oral', 'capsule')

  // Expanded common ConMed list
  add('Aspirin', 'Bayer Aspirin', 'Antiplatelet / analgesic')
  add('Clopidogrel', 'Plavix', 'Antiplatelet')
  add('Warfarin', 'Coumadin', 'Anticoagulant')
  add('Apixaban', 'Eliquis', 'Direct oral anticoagulant')
  add('Rivaroxaban', 'Xarelto', 'Direct oral anticoagulant')
  add('Carvedilol', 'Coreg', 'Beta blocker')
  add('Metoprolol', 'Lopressor', 'Beta blocker')
  add('Furosemide', 'Lasix', 'Loop diuretic')
  add('Spironolactone', 'Aldactone', 'Potassium-sparing diuretic')
  add('Nitroglycerin', 'Nitrostat', 'Antianginal', 'sublingual', 'tablet')
  add('Insulin glargine', 'Lantus', 'Long-acting insulin', 'subcutaneous', 'injection')
  add('Insulin lispro', 'Humalog', 'Rapid-acting insulin', 'subcutaneous', 'injection')
  add('Semaglutide', 'Ozempic', 'GLP-1 receptor agonist', 'subcutaneous', 'injection')
  add('Sitagliptin', 'Januvia', 'DPP-4 inhibitor')
  add('Gabapentin', 'Neurontin', 'Anticonvulsant / neuropathic pain')
  add('Pregabalin', 'Lyrica', 'Anticonvulsant / neuropathic pain')
  add('Tramadol', 'Ultram', 'Opioid analgesic')
  add('Oxycodone', 'OxyContin', 'Opioid analgesic')
  add('Hydrocodone-acetaminophen', 'Vicodin', 'Opioid combination')
  add('Cyclobenzaprine', 'Flexeril', 'Muscle relaxant')
  add('Methotrexate', 'Trexall', 'DMARD', 'oral', 'tablet')
  add('Hydroxychloroquine', 'Plaquenil', 'DMARD')
  add('Adalimumab', 'Humira', 'TNF inhibitor', 'subcutaneous', 'injection')
  add('Montelukast', 'Singulair', 'Leukotriene receptor antagonist')
  add('Tiotropium', 'Spiriva', 'Long-acting anticholinergic', 'inhalation', 'inhaler')
  add('Ledipasvir-sofosbuvir', 'Harvoni', 'Direct-acting antiviral', 'oral', 'tablet')
  add('Cetirizine', 'Zyrtec', 'Antihistamine')
  add('Loratadine', 'Claritin', 'Antihistamine')
  add('Diphenhydramine', 'Benadryl', 'Antihistamine')
  add('Fluticasone nasal spray', 'Flonase', 'Intranasal corticosteroid', 'intranasal', 'spray')
  add('Alendronate', 'Fosamax', 'Bisphosphonate')
  add('Calcium carbonate', 'Caltrate', 'Mineral supplement')
  add('Vitamin D', 'D3', 'Vitamin supplement', 'oral', 'capsule')
  add('Ferrous sulfate', 'Feosol', 'Iron supplement')
  add('Potassium chloride', 'Klor-Con', 'Electrolyte supplement', 'oral', 'tablet')
  add('Multivitamin', 'Centrum', 'Vitamin supplement', 'oral', 'tablet')
  add('Melatonin', null, 'Dietary supplement', 'oral', 'tablet')
  add('Tamsulosin', 'Flomax', 'Alpha blocker')
  add('Finasteride', 'Proscar', '5-alpha reductase inhibitor')
  add('Oxybutynin', 'Ditropan', 'Anticholinergic')
  add('Estradiol', 'Estrace', 'Estrogen', 'oral', 'tablet')
  add('Medroxyprogesterone', 'Provera', 'Progestin')
  add('Combined oral contraceptive', 'Ortho Tri-Cyclen', 'Hormonal contraceptive', 'oral', 'tablet')
  add('Levothyroxine', 'Synthroid', 'Thyroid hormone') // deduped below
  add('Methimazole', 'Tapazole', 'Antithyroid agent')
  add('Allopurinol', 'Zyloprim', 'Xanthine oxidase inhibitor')
  add('Colchicine', 'Colcrys', 'Antigout agent')
  add('Duloxetine', 'Cymbalta', 'SNRI')
  add('Bupropion', 'Wellbutrin', 'Atypical antidepressant')
  add('Quetiapine', 'Seroquel', 'Antipsychotic')
  add('Lorazepam', 'Ativan', 'Benzodiazepine')
  add('Zolpidem', 'Ambien', 'Sedative-hypnotic')
  add('Donepezil', 'Aricept', 'Cholinesterase inhibitor')
  add('Memantine', 'Namenda', 'NMDA antagonist')
  add('Timolol eye drops', 'Timoptic', 'Ophthalmic beta blocker', 'ophthalmic', 'drops')
  add('Latanoprost', 'Xalatan', 'Prostaglandin analogue', 'ophthalmic', 'drops')
  add('Artificial tears', 'Refresh', 'Ophthalmic lubricant', 'ophthalmic', 'drops')
  add('Azithromycin', 'Zithromax', 'Macrolide antibiotic', 'oral', 'tablet')
  add('Ciprofloxacin', 'Cipro', 'Fluoroquinolone antibiotic')
  add('Doxycycline', 'Vibramycin', 'Tetracycline antibiotic', 'oral', 'capsule')
  add('Clindamycin', 'Cleocin', 'Lincosamide antibiotic', 'oral', 'capsule')
  add('Trimethoprim-sulfamethoxazole', 'Bactrim', 'Sulfonamide antibiotic')
  add('Acyclovir', 'Zovirax', 'Antiviral')
  add('Oseltamivir', 'Tamiflu', 'Antiviral', 'oral', 'capsule')
  add('Empagliflozin', 'Jardiance', 'SGLT2 inhibitor')
  add('Glipizide', 'Glucotrol', 'Sulfonylurea')
  add('Pioglitazone', 'Actos', 'Thiazolidinedione')
  add('Rosuvastatin', 'Crestor', 'HMG-CoA reductase inhibitor')
  add('Ezetimibe', 'Zetia', 'Cholesterol absorption inhibitor')
  add('Sacubitril-valsartan', 'Entresto', 'ARNI', 'oral', 'tablet')
  add('Diltiazem', 'Cardizem', 'Calcium channel blocker')
  add('Verapamil', 'Calan', 'Calcium channel blocker')
  add('Isosorbide mononitrate', 'Imdur', 'Nitrate')
  add('Digoxin', 'Lanoxin', 'Cardiac glycoside')
  add('Heparin', null, 'Anticoagulant', 'subcutaneous', 'injection')
  add('Enoxaparin', 'Lovenox', 'Low molecular weight heparin', 'subcutaneous', 'injection')
  add('Mesalamine', 'Asacol', 'Aminosalicylate', 'oral', 'tablet')
  add('Ondansetron', 'Zofran', 'Antiemetic', 'oral', 'tablet')
  add('Promethazine', 'Phenergan', 'Antiemetic')
  add('Loperamide', 'Imodium', 'Antidiarrheal')
  add('Docusate', 'Colace', 'Stool softener')
  add('Polyethylene glycol', 'Miralax', 'Osmotic laxative', 'oral', 'powder')
  add('Lactulose', 'Enulose', 'Osmotic laxative', 'oral', 'solution')
  add('Famotidine', 'Pepcid', 'H2 blocker')
  add('Sucralfate', 'Carafate', 'GI protectant', 'oral', 'tablet')
  add('Ursodiol', 'Actigall', 'Bile acid')
  add('Tizanidine', 'Zanaflex', 'Muscle relaxant')
  add('Naproxen', 'Aleve', 'NSAID')
  add('Celecoxib', 'Celebrex', 'COX-2 inhibitor')
  add('Diclofenac gel', 'Voltaren', 'Topical NSAID', 'topical', 'gel')
  add('Lidocaine patch', 'Lidoderm', 'Topical anesthetic', 'topical', 'patch')
  add('Mupirocin', 'Bactroban', 'Topical antibiotic', 'topical', 'ointment')
  add('Triamcinolone cream', 'Kenalog', 'Topical corticosteroid', 'topical', 'cream')
  add('Ketoconazole shampoo', 'Nizoral', 'Antifungal', 'topical', 'shampoo')
  add('Fluconazole', 'Diflucan', 'Antifungal')
  add('Nystatin', 'Mycostatin', 'Antifungal', 'oral', 'suspension')
  add('Levetiracetam', 'Keppra', 'Anticonvulsant')
  add('Lamotrigine', 'Lamictal', 'Anticonvulsant')
  add('Topiramate', 'Topamax', 'Anticonvulsant')
  add('Carbamazepine', 'Tegretol', 'Anticonvulsant')
  add('Sumatriptan', 'Imitrex', 'Antimigraine', 'oral', 'tablet')
  add('Rizatriptan', 'Maxalt', 'Antimigraine', 'oral', 'tablet')
  add('Propranolol', 'Inderal', 'Beta blocker')
  add('Amitriptyline', 'Elavil', 'Tricyclic antidepressant')
  add('Nortriptyline', 'Pamelor', 'Tricyclic antidepressant')
  add('Venlafaxine', 'Effexor', 'SNRI')
  add('Mirtazapine', 'Remeron', 'Atypical antidepressant')
  add('Trazodone', 'Desyrel', 'Sedating antidepressant')
  add('Buspirone', 'Buspar', 'Anxiolytic')
  add('Clonazepam', 'Klonopin', 'Benzodiazepine')
  add('Methylphenidate', 'Ritalin', 'Stimulant')
  add('Amphetamine-dextroamphetamine', 'Adderall', 'Stimulant')
  add('Atomoxetine', 'Strattera', 'Non-stimulant ADHD agent')
  add('Risperidone', 'Risperdal', 'Antipsychotic')
  add('Aripiprazole', 'Abilify', 'Antipsychotic')
  add('Olanzapine', 'Zyprexa', 'Antipsychotic')
  add('Lithium carbonate', 'Lithobid', 'Mood stabilizer')
  add('Valproic acid', 'Depakote', 'Anticonvulsant / mood stabilizer')
  add('Naloxone', 'Narcan', 'Opioid antagonist', 'intranasal', 'spray')
  add('Nicotine patch', 'Nicoderm', 'Smoking cessation', 'transdermal', 'patch')
  add('Varenicline', 'Chantix', 'Smoking cessation')
  add('Denosumab', 'Prolia', 'RANK ligand inhibitor', 'subcutaneous', 'injection')
  add('Teriparatide', 'Forteo', 'Anabolic agent', 'subcutaneous', 'injection')

  const seen = new Set()
  const out = []
  for (const row of m) {
    const key = `${row.medication_name.toLowerCase().trim()}|${(row.route ?? '').toLowerCase()}|${(row.dosage_form ?? '').toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out.map((row, idx) => ({ ...row, external_seed_id: 10000 + idx + 1 }))
}

/**
 * Link specs reference common_name + icd10 / medication_name for resolution at seed time.
 */
export function buildSuggestedLinks() {
  return [
    { pathology: ['Hypertension', 'I10'], medication: ['Lisinopril', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Hypertension', 'I10'], medication: ['Amlodipine', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Hypertension', 'I10'], medication: ['Hydrochlorothiazide', 'oral', 'tablet'], rank: 3 },
    { pathology: ['Hypertension', 'I10'], medication: ['Losartan', 'oral', 'tablet'], rank: 4 },
    { pathology: ['Atrial fibrillation', 'I48.91'], medication: ['Apixaban', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Atrial fibrillation', 'I48.91'], medication: ['Metoprolol', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Type 2 diabetes', 'E11.9'], medication: ['Metformin', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Type 2 diabetes', 'E11.9'], medication: ['Insulin glargine', 'subcutaneous', 'injection'], rank: 2 },
    { pathology: ['Type 2 diabetes', 'E11.9'], medication: ['Semaglutide', 'subcutaneous', 'injection'], rank: 3 },
    { pathology: ['Diabetes', 'E11.8'], medication: ['Metformin', 'oral', 'tablet'], rank: 1 },
    { pathology: ['GERD', 'K21.9'], medication: ['Omeprazole', 'oral', 'tablet'], rank: 1 },
    { pathology: ['GERD', 'K21.9'], medication: ['Pantoprazole', 'oral', 'tablet'], rank: 2 },
    { pathology: ['GERD', 'K21.9'], medication: ['Famotidine', 'oral', 'tablet'], rank: 3 },
    { pathology: ['Asthma', 'J45.909'], medication: ['Albuterol', 'inhalation', 'inhaler'], rank: 1 },
    { pathology: ['Asthma', 'J45.909'], medication: ['Fluticasone', 'inhalation', 'inhaler'], rank: 2 },
    { pathology: ['Asthma', 'J45.909'], medication: ['Montelukast', 'oral', 'tablet'], rank: 3 },
    { pathology: ['COPD', 'J44.9'], medication: ['Albuterol', 'inhalation', 'inhaler'], rank: 1 },
    { pathology: ['COPD', 'J44.9'], medication: ['Tiotropium', 'inhalation', 'inhaler'], rank: 2 },
    { pathology: ['Depression', 'F32.9'], medication: ['Sertraline', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Depression', 'F32.9'], medication: ['Escitalopram', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Anxiety', 'F41.9'], medication: ['Sertraline', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Anxiety', 'F41.9'], medication: ['Buspirone', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Headache', 'R51.9'], medication: ['Ibuprofen', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Headache', 'R51.9'], medication: ['Acetaminophen', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Migraine', 'G43.909'], medication: ['Sumatriptan', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Migraine', 'G43.909'], medication: ['Ibuprofen', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Osteoarthritis', 'M19.90'], medication: ['Ibuprofen', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Osteoarthritis', 'M19.90'], medication: ['Acetaminophen', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Rheumatoid arthritis', 'M06.9'], medication: ['Methotrexate', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Rheumatoid arthritis', 'M06.9'], medication: ['Adalimumab', 'subcutaneous', 'injection'], rank: 2 },
    { pathology: ['Hyperlipidemia', 'E78.5'], medication: ['Atorvastatin', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Hyperlipidemia', 'E78.5'], medication: ['Rosuvastatin', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Hypothyroidism', 'E03.9'], medication: ['Levothyroxine', 'oral', 'tablet'], rank: 1 },
    { pathology: ['CKD', 'N18.9'], medication: ['Lisinopril', 'oral', 'tablet'], rank: 1 },
    { pathology: ['UTI', 'N39.0'], medication: ['Trimethoprim-sulfamethoxazole', 'oral', 'tablet'], rank: 1 },
    { pathology: ['UTI', 'N39.0'], medication: ['Ciprofloxacin', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Glaucoma', 'H40.9'], medication: ['Latanoprost', 'ophthalmic', 'drops'], rank: 1 },
    { pathology: ['Dry eye', 'H04.129'], medication: ['Artificial tears', 'ophthalmic', 'drops'], rank: 1 },
    { pathology: ['Hepatitis C', 'B18.2'], medication: ['Ledipasvir-sofosbuvir', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Insomnia', 'G47.00'], medication: ['Zolpidem', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Insomnia', 'G47.00'], medication: ['Melatonin', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Allergic rhinitis', 'J30.9'], medication: ['Cetirizine', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Allergic rhinitis', 'J30.9'], medication: ['Fluticasone nasal spray', 'intranasal', 'spray'], rank: 2 },
    { pathology: ['Heart failure', 'I50.9'], medication: ['Furosemide', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Heart failure', 'I50.9'], medication: ['Carvedilol', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Heart failure', 'I50.9'], medication: ['Sacubitril-valsartan', 'oral', 'tablet'], rank: 3 },
    { pathology: ['Gout', 'M10.9'], medication: ['Allopurinol', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Gout', 'M10.9'], medication: ['Colchicine', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Psoriasis', 'L40.9'], medication: ['Triamcinolone cream', 'topical', 'cream'], rank: 1 },
    { pathology: ['Eczema', 'L20.9'], medication: ['Triamcinolone cream', 'topical', 'cream'], rank: 1 },
    { pathology: ['Neuropathy', 'G62.9'], medication: ['Gabapentin', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Neuropathy', 'G62.9'], medication: ['Pregabalin', 'oral', 'tablet'], rank: 2 },
    { pathology: ['ADHD', 'F90.9'], medication: ['Methylphenidate', 'oral', 'tablet'], rank: 1 },
    { pathology: ['ADHD', 'F90.9'], medication: ['Atomoxetine', 'oral', 'tablet'], rank: 2 },
    { pathology: ['Benign prostatic hyperplasia', 'N40.0'], medication: ['Tamsulosin', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Osteoporosis', 'M81.0'], medication: ['Alendronate', 'oral', 'tablet'], rank: 1 },
    { pathology: ['Osteoporosis', 'M81.0'], medication: ['Vitamin D', 'oral', 'capsule'], rank: 2 },
  ].map((row) => ({
    pathology_common_name: row.pathology[0],
    pathology_icd10: row.pathology[1],
    medication_name: row.medication[0],
    medication_route: row.medication[1],
    medication_dosage_form: row.medication[2],
    relation_rank: row.rank,
    relation_type: 'common_concomitant',
    notes: 'Coordinator suggestion only — not a clinical recommendation.',
  }))
}
