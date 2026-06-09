# Financial Runtime Lifecycle - G1

**Date:** 2026-06-02  
**Status:** Execution guide  
**Scope:** Payment lifecycle positioning and screen failure financial logic  

This document extends Financial Runtime without turning Vilo OS into accounting, AR, or sponsor billing software.

---

## 1. Product Positioning

Financial Runtime is native clinical execution intelligence.

It answers:

- What was expected?
- What was executed?
- What was earned?
- What is invoiceable later?
- What revenue is at risk?
- What should the coordinator do now?

It does not replace:

- accounting
- sponsor invoicing
- AR collections
- ClinIQ
- budget negotiation

ClinIQ patterns may be integrated later for ledger, AR, budget negotiation, leakage, and collections.

---

## 2. Core Rule

Visit payment is not visit revenue.

Revenue must be decomposed into components:

- visit payment
- procedure payment
- pass-through costs
- patient stipend

Therefore:

```text
Screen Fail Visit = $0 visit payment
```

does not mean:

```text
Screen Fail Visit = $0 revenue
```

Billable labs, imaging, procedures, pass-through reimbursements, and stipends remain independent runtime-derived components.

---

## 3. Current Runtime Anchor

Existing Financial Runtime already derives:

```text
Expected
  -> Executed
  -> Earned
  -> Leakage
```

Existing anchors:

- `lib/financial-runtime/compute-visit.ts`
- `lib/financial-runtime/load/visit-context.ts`
- `lib/financial-runtime/compute/expected.ts`
- `lib/financial-runtime/compute/executed.ts`
- `lib/financial-runtime/compute/earned.ts`
- `lib/financial-runtime/compute/leakage.ts`
- `visit_financial_runtime_projections`
- `subject_financial_runtime_projections`

---

## 4. Lifecycle Vocabulary

Payment lifecycle statuses:

- `expected`
- `earned`
- `invoiced`
- `paid`
- `reverted`
- `disputed`
- `written_off`

G1 only derives expected/earned/written-off component state. Invoiced/paid/disputed/reverted require a future invoice/AR integration.

---

## 5. G1 Implementation Boundary

G1 adds a derived `paymentLifecycle` object to visit financial runtime output and projection snapshot.

No migration is required.

The lifecycle currently supports:

- visit payment component
- procedure payment components
- screen failure zero visit payment logic
- preservation of procedure earned revenue independent from visit payment

## Study Workspace Presence

Study Workspace now surfaces a read-only `Financial Runtime` summary in the Study Command Center.

It shows:

- projected visits
- leakage visits
- expected procedure count
- executed procedure count
- earned procedure count
- leakage item count
- average earned rate
- max leakage score

This is runtime-derived financial intelligence, not accounting, AR, or invoicing.

Deferred:

- monetary amounts
- rate tables
- pass-through actuals
- patient stipend actual payments
- invoice queue
- AR allocations
- reversals/disputes/write-offs as persisted events

---

## 6. Screen Failure Logic

If subject enrollment status is `screen_failed`:

```text
visitPaymentEligible = false
visitPaymentExclusionReason = screen_failure_zero_visit_payment
```

Procedure components remain evaluated independently:

```text
procedure completed
  + billable
  + signed
  + source submitted
  + no blockers
  -> earned
```

This prevents the common error:

```text
visit payment = visit revenue
```

---

## 7. Future ClinIQ Integration

ClinIQ should be connected after G1 as a downstream financial intelligence integration:

```text
Vilo Runtime Evidence
  -> Financial Runtime Components
  -> ClinIQ Ledger / AR / Negotiation
```

ClinIQ should not become the source of clinical execution truth.
