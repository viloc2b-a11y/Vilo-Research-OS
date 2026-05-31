# Biospecimen Conditional Outcome Patterns

## 1. Shift from Absolute to Conditional Logic
The VIP Engine must eliminate "This sample is invalid" and replace it with:
**"Potential impact depends on [X], [Y], and [Z]."**

## 2. New Conditional Patterns

### Pattern: Collection Time Deviation
- **Condition A (Short Half-life PK):** A 15-minute delay significantly shifts the Cmax curve. *Outcome:* Likely exclusion from Per-Protocol PK analysis.
- **Condition B (Long Half-life IgG):** A 15-minute delay is statistically meaningless. *Outcome:* Minor deviation, fully usable data.

### Pattern: Processing Delay
- **Condition A (Live PBMC isolation):** Delays >4 hours result in cell death. *Outcome:* Sample scientifically invalid.
- **Condition B (Serum Chemistry):** Delays of 2 hours usually permissible. *Outcome:* Minor deviation, acceptable analysis.

### Pattern: Temperature Excursion (Freezer)
- **Condition A (RNA/Transcriptomics):** Excursion to -20°C from -80°C activates RNases. *Outcome:* Sample destroyed.
- **Condition B (DNA/Genetics):** DNA is highly stable. *Outcome:* Sample likely salvaged pending Sponsor approval.

### Pattern: Fasting Violation
- **Condition A (Lipid/Glucose Endpoint):** The patient ate breakfast. *Outcome:* Primary data invalid.
- **Condition B (Genetic Testing):** The patient ate breakfast. *Outcome:* DNA is unaffected, fasting violation is clinically irrelevant.

## 3. VIP Rule Update
*Rule:* Whenever assessing a deviation, the engine MUST output the dependency variables (Analyte stability, Protocol objective, Lab Manual tolerance) rather than assuming worst-case destruction.
