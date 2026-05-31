# Biospecimen Statistical Impact Intelligence

## 1. Overview
The ultimate fate of a clinical trial depends on the **Statistical Analysis Plan (SAP)**. Deviations do not automatically ruin a trial; they are mathematically handled by the biostatisticians.

## 2. Deviation Impact Mapping

| Deviation Type | Primary Endpoint Impact | Secondary/Exploratory Impact | Safety Impact | Statistical Handling |
| :--- | :--- | :--- | :--- | :--- |
| **Missing Primary Timepoint** | CRITICAL | Moderate | N/A | Imputation (e.g., LOCF) or dropped from Per-Protocol set. |
| **PK Draw Delayed (+2 hours)** | HIGH (if early phase) | Low | Low | Actual time used for non-compartmental analysis (NCA). Curve shifted. |
| **Hemolyzed Safety Lab** | N/A | N/A | HIGH | Excluded from safety tables. Requires re-draw to prevent missing safety signal. |
| **Fasting Violation (Lipid Trial)** | HIGH | High | Low | Data point flagged and excluded from primary efficacy modeling. |

## 3. Statistical Populations
The engine must understand that a sample deviation can exclude a patient from one population but keep them in another:
- **Intention-to-Treat (ITT):** Includes all randomized patients regardless of sample deviations.
- **Per-Protocol (PP):** Excludes patients with major sample/dosing deviations.
- **Safety Population:** Includes everyone who received at least one dose, regardless of whether their efficacy samples were hemolyzed or lost.
