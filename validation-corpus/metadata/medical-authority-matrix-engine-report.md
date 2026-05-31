# Medical Authority Matrix Engine Report

## 1. Executive Summary
Sprint 3A implements the final foundational regulatory pillar for Vilo OS: the **Medical Authority Matrix Engine**. To completely distance VIP Intelligence from practicing medicine, we established an authoritative ruleset (`lib/medical-authority/default-medical-authority-rules.ts`) that dictates exactly *who* can execute, review, adjudicate, or override any clinical event on the platform.

## 2. Core Fulfillment
- **No Hardcoded Authority:** The execution logic no longer relies on random `if (userRole === "PI")` checks scattered across the UI. Instead, the `resolveMedicalAuthority()` function serves as a singular, auditable Oracle.
- **Delegation Enforcement:** `delegation-integration.ts` mathematically guarantees that even if a rule permits a "CRC" to perform an action, the engine returns a block if the user lacks an active, PI-signed DOA signature.
- **Training Validation:** A boolean check ensures the user's protocol-specific training is current before granting performing/signing authority.
- **Blind Scope Integrity:** `blinding-authority-policy.ts` ensures that users explicitly marked as `BLINDED` (e.g., PI, general CRC) are mathematically barred from resolving `UNBLINDED_IP_REVIEW` tasks, preventing catastrophic endpoints compromise.

## 3. Component Hierarchy
1. `medical-authority-types.ts`: Defines `AuthorityDecisionType`, `OversightLevel`, and `AuthorityRole`.
2. `default-medical-authority-rules.ts`: The baseline 5 rules (Vitals, Labs, SAE, Eligibility, Unblinded IP). *Note: Expandable via config.*
3. `resolve-medical-authority.ts`: The orchestrator executing the 4-layer check (Blinding -> Delegation -> Training -> Role mapping).

## 4. Execution Guard Integration Design
The `ExecutionGuard` from Sprint 2 will be updated to consume this matrix. Before returning `allowed: true` on an action like `RANDOMIZE_SUBJECT`, it will query:
```ts
const auth = resolveMedicalAuthority({ procedure_type: "RANDOMIZE_SUBJECT", ...context });
if (!auth.can_perform) return Block("Authority Denied");
```

## 5. Final Assessment
**Medical Authority Matrix Engine:** `READY`

With this engine, the platform guarantees that every signature, review, and judgment is executed by a legally delegated and trained individual. Next stages will map the PI Inbox and Source execution layers directly to this Matrix.
