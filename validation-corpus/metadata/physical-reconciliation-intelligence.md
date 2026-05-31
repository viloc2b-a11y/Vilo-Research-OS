# Physical Reconciliation Intelligence

## 1. Overview
The "Paper vs. Physical Reality" gap exposes the site to massive accountability risks, especially in Pharmacy and Biospecimen domains. VIP has been upgraded to understand that a digital ledger entry is not physical truth.

## 2. Hardened Logic
- **`PHYSICAL_RECONCILIATION_REQUIRED`:** VIP understands that digital logs must periodically be verified against physical stock.
- **`DOCUMENTED_VS_PHYSICAL_MISMATCH`:** If the IRT log says 20 pills were returned, but the CRC inputs 18 physical pills counted, VIP triggers a HARD STOP mismatch escalation rather than passively saving the discrepancy.
- **`DOUBLE_VERIFICATION_REQUIRED`:** For critical physical actions (e.g., destroying IP), VIP forces a second delegated user to authenticate, preventing single-actor physical counting errors.
- **`CHAIN_OF_CUSTODY_REALITY_CHECK`:** VIP treats the physical movement of assets (Pharmacy -> CRC -> Patient) as distinct from the digital source document generation, identifying when a CoC log lacks the necessary wet/electronic signatures.

## 3. Site Defense Impact
Protects the site from FDA findings regarding "inadequate control of investigational product" by enforcing physical reality checks before the auditor finds the mismatch.
