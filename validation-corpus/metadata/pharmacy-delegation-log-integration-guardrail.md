# Pharmacy Delegation Log Integration Guardrail

## 1. Overview
The Pharmacy Runtime Ledger must not be responsible for calculating a user's permissions or determining if they are blinded or unblinded. To adhere to strict GCP compliance and prevent security vulnerabilities, that responsibility lies exclusively with the **Delegation of Authority (DOA) Log Module**. 

This integration guardrail effectively acts as an "API Contract" ensuring that before any pharmacy ledger mutation occurs, the system cryptographically and legally checks the DOA Log.

## 2. The Integration Boundary

The `blinding-access-policy.ts` file acts as the boundary. It exposes a placeholder interface: `resolveActorDelegationContext(actor_id, study_id, site_id)`.

When fully implemented, the Ledger will request the context and expect:
- `is_active`
- `role`
- `blind_scope` (BLINDED / UNBLINDED)
- `authorized_tasks`
- `pi_approved`
- `training_verified`

### 2.1 The Validation Engine
Before any event moves from `PENDING_REVIEW` to `APPROVED`, the ledger invokes `validateDelegationPolicyForAction()`. This function executes the following hard checks:
1. Is the actor's assignment active?
2. Has the Principal Investigator (PI) electronically signed off on this delegation?
3. Has the required protocol training been marked as verified?
4. Is the specific task (e.g., `DISPENSE_IP`) in the actor's `authorized_tasks` array?
5. Does the `blind_scope` prohibit the action?

## 3. Pharmacist Identity vs Investigator Identity
By decoupling the ledger from the authorization matrix, we solve the "Unblinded Pharmacist" problem. 
- A Clinical Research Coordinator (CRC) is designated `BLINDED` in the DOA. If they attempt to approve an `IP_RECEIVED` event, the system will reject it because they lack the `VIEW_UNBLINDED_INVENTORY` and `RECEIVE_IP` tasks.
- If a CRC attempts to `ADMINISTER_IP`, the ledger checks the DOA. If the PI did not delegate the `ADMINISTER_IP` task to them, the ledger blocks the administration event from being logged.

## 4. Final Assessment
**Pharmacy Delegation Integration Point: `READY`**

**Justification:** The architecture fundamentally blocks the Pharmacy Ledger from self-approving privileged actions. The ledger forces a call to `resolveActorDelegationContext()`. If the Delegation Log module is not built to supply that context, the ledger cannot operate. This creates a hard architectural dependency, guaranteeing that Vilo OS will never process unblinded pharmacy transactions without a fully verified GCP Delegation Log.
