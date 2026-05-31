# Financial Uncertainty Intelligence

## 1. Overview
The "Financial Black Box" gap occurs because VIP lacks access to the exact dollar values ($) negotiated in the Clinical Trial Agreement (CTA). VIP has been hardened to never hallucinate or invent financial data.

## 2. Hardened Logic
- **`FINANCIAL_RISK_UNKNOWN_WITHOUT_CTA`:** VIP will actively output "financial impact unknown — CTA/ClinIQ required" rather than guessing a penalty amount.
- **`CTA_DEPENDENT_PAYMENT_RISK`:** VIP connects clinical failures (like an aging query) to payment delays qualitatively ("Milestone at risk") without quantifying the loss.
- **`CLINIQ_REQUIRED_FOR_DOLLAR_AMOUNT`:** Establishes a strict separation of concerns. Vilo OS (clinical) triggers the risk signal; ClinIQ (financial) calculates the penalty.
- **`PAYMENT_HOLDBACK_NOT_ASSUMED`:** Eradicates the assumption of a "standard 20% holdback". VIP requires explicit CTA configuration to project holdbacks.

## 3. Site Defense Impact
Prevents the Site Director from making catastrophic business decisions based on hallucinated AI cash-flow projections. By demanding ClinIQ API integration, VIP ensures absolute financial truth.
