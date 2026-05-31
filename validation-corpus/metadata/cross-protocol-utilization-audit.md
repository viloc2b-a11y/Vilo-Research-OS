# Cross-Protocol Utilization Audit Report

## 1. Overview
This audit evaluates the protocol utilization distribution across all validation gates within Vilo OS (Sprints 1 through 6). The objective is to determine if the Vilo Intelligence Platform (VIP) and the Clinical Intelligence Engine were adequately exposed to diverse clinical domains, or if the model overfit to a single study type (e.g., Osteoarthritis).

## 2. Protocol Utilization Matrix

| Protocol ID | Used for Reader | Used for Parser | Used for Intelligence | Used for Source Blueprint | Used for VIP Patterns | Notes |
|-------------|-----------------|-----------------|-----------------------|---------------------------|-----------------------|-------|
| **PROTOCOL_A004** | YES | YES | **YES** | **YES** | **YES** | Osteoarthritis. Primary driver for Intelligence, Hard Stops, and VIP Memory (OCT, Triplicate ECGs, 14-day Run-in). |
| **PROTOCOL_A011** | YES | YES | NO | NO | NO | Antiviral/Influenza. Heavy use in early Sprints (Reader/Parser) for complex SoA grid flattening. |
| **PROTOCOL_A014** | YES | YES | NO | NO | NO | Biospecimen/Collection. Used for Reader validation of nested footnotes and sample logic. |
| **AMENDMENT_A101** | YES | YES | NO | NO | NO | Massive Antiviral Platform (Covid/Flu). Used strictly to stress-test the Parser_Extraction_Result limits. |
| **PARA_OA_012** | NO | NO | NO | NO | NO | Production Smoke Test only. Reconciled successfully for identity preservation, but not parsed. |
| **MV40618** | NO | NO | NO | NO | NO | Production Smoke Test validation target. |

## 3. Structural vs. Intelligent Utilization

**Protocols used only structurally (Reader/Parser):**
- `PROTOCOL_A011`
- `PROTOCOL_A014`
- `AMENDMENT_A101`

**Protocols used intelligently (Blueprint/VIP):**
- `PROTOCOL_A004`

## 4. Clinical Domains Represented

| Domain | Represented in Pipeline | Depth of Intelligence Applied |
|--------|-------------------------|-------------------------------|
| **Osteoarthritis** | YES | **DEEP** (Run-in, IA Washouts, K-L Grading) |
| **Influenza / Antiviral** | YES | **SHALLOW** (Table structure extraction only) |
| **Ophthalmology** | YES | **DEEP** (OCT macular edema exclusion logic) |
| **Household Contact / Transmission** | YES | **SHALLOW** (Parsed from A011 structural validation) |
| **PK-Heavy** | YES | **SHALLOW** (Parsed from A011/A101 structural validation) |
| **Lab-Heavy** | YES | **MODERATE** (General safety labs in A004) |

## 5. Intelligence Assessment

**Q: Did the motor learn reusable operational patterns from multiple protocols, or mostly from PROTOCOL_A004?**

**A:** The motor learned *almost exclusively* from `PROTOCOL_A004`. 
While the underlying **Native Reader** and **Parser** models are domain-agnostic and highly robust across virology, biospecimen, and pain studies (proven by the multi-format validations on A011 and A101), the **Operational Intelligence**, **Source Blueprint Compiler**, and **VIP Memory Layer** were trained via an extremely deep, focused dive into `A004`. 

Consequently, the current VIP Seed Database (`validation-corpus/vip-memory/protocol-intelligence-patterns.candidate.json`) is heavily weighted toward OA-specific pain diary endpoints, OCT ophthalmology exclusions, and conditional ECG cascades.

## 6. Missing Enrichment Opportunities
VIP currently lacks deep operational abstractions for:
1. **PK/PD Strict Timestamping:** A011 contains complex hour-by-hour Pharmacokinetic cascades (e.g., Pre-dose, 0.5h, 1h, 2h, 4h). VIP has not yet abstracted the "Source Blueprint Pattern" for PK deviations.
2. **Transmission / Household Contact Logs:** A011 features tracking secondary subjects (Household contacts). VIP does not yet know how to build a multi-subject household linkage log.
3. **Bio-specimen Archiving:** A014 features heavy longitudinal tissue banking rules.

## 7. Final Recommendation

- [ ] **Enough for production pilot?** YES. For standard interventional phase II/III trials similar to Rheumatology/OA/Pain, the system will perform exceptionally well.
- [ ] **Needs more protocol intelligence passes?** YES.
- [X] **Needs VIP enrichment batch:** **CRITICAL**. Before exposing VIP to complex Virology or Oncology trials, we must run the *Protocol Intelligence Validation* and *Source Blueprint Compiler* on `PROTOCOL_A011` and `AMENDMENT_A101` to capture infectious disease-specific patterns (like Swab Compliance, Viral Shedding, and PK sampling) into the governed VIP Memory.
