# Pharmacy Runtime Ledger Reconciliation Rules

## 1. Overview
The ultimate test of a Clinical Pharmacy is the IP Accountability Equation. If the physical count does not perfectly match the calculated ledger projection, the site is in violation of GCP. The Vilo OS Reconciliation Engine mathematically projects the inventory state strictly from `APPROVED` ledger events.

## 2. The Inventory State Projection
The current state of any specific `kit_id` or bulk `lot_number` is derived by aggregating its event history into the following buckets:

- **Received:** Total quantity from `IP_RECEIVED` events.
- **Available:** Total quantity physically in active, usable stock.
- **Dispensed:** Total quantity from `IP_DISPENSED` events.
- **Administered:** Total quantity from `IP_ADMINISTERED` events.
- **Returned:** Total quantity from `IP_RETURNED` events.
- **Destroyed:** Total quantity from `IP_DESTROYED` events.
- **Quarantined:** Total quantity from `IP_QUARANTINED` minus `IP_RELEASED`.
- **Missing:** Total quantity from `IP_MISSING` events.
- **Unreconciled:** Any discrepancy between the calculated total and a physical `INVENTORY_RECONCILIATION` count.

## 3. The Accountability Equation
The engine continuously verifies the following mathematical rule for the site as a whole, and for each specific lot:

**`Total Received = Available + Dispensed + Administered + Returned + Destroyed + Quarantined + Missing + Unreconciled`**

If this equation does not perfectly balance, the system flags a global `ACCOUNTABILITY_DISCREPANCY` alert, requiring pharmacist investigation.

## 4. Hard Stops & Operational Logic

### 4.1 Quarantine Block
- If the calculated state of a Kit is `QUARANTINED`, the system MUST block any subsequent `IP_DISPENSED` or `IP_ADMINISTERED` events for that Kit.
- A Kit can only exit `QUARANTINED` state if an `IP_RELEASED` event is appended.
- An `IP_RELEASED` event MUST be mathematically preceded by a `SPONSOR_RELEASE` event (proving the Sponsor authorized the release).

### 4.2 Lifecycle Sequencing
The ledger detects impossible state transitions and rejects them during the `PENDING_REVIEW` phase:
- Cannot append `IP_DISPENSED` if `Available = 0` for that lot/kit.
- Cannot append `IP_RETURNED` for a Kit that has not previously been logged as `IP_DISPENSED`.
- Cannot append `IP_DESTROYED` for a Kit that is currently in `Available` status (it must either be `RETURNED` or `QUARANTINED/EXPIRED` first).
