# Pharmacy Runtime Ledger Architecture

## 1. Core Principle
**Protocol Intake extracts rules. Pharmacy Runtime Ledger processes events.**
These two engines within Vilo OS are decoupled. The Intake engine defines the "Hard Stops" and parameters (e.g., Temperature Limits), while the Pharmacy Ledger processes real-time operational data (e.g., Daily temperature logs, IRT dispense files) against those parameters to calculate the current physical state of Investigational Product (IP) at the site.

## 2. Event-Sourced Architecture
The ledger uses an Event Sourcing paradigm. There is no mutable "Inventory" table where quantities are directly updated (CRUD). Instead, all state is calculated by aggregating an immutable stream of atomic `PharmacyEvent` records.

### 2.1 Why Event Sourcing?
- **ALCOA+ Compliance:** True append-only audit trails natively support GCP standards.
- **Time Travel:** Allows the system to calculate the exact inventory state at any specific historical timestamp (critical during FDA audits).
- **Error Correction:** Mistakes in dispensing are fixed by appending a compensatory event (e.g., `ACCOUNTABILITY_DISCREPANCY` or `IP_RETURNED`), not by deleting or overwriting the original dispense event.

## 3. Data Flow
1. **Ingest Phase:** A tabular file (CSV, Excel) representing operational logs (e.g., RTSM/IRT Shipment Report, Temperature Logger Export) is uploaded.
2. **Normalization Phase:** The rows of the tabular file are mapped to standard `PharmacyEvent` types (`IP_RECEIVED`, `TEMP_EXCURSION`).
3. **Reconciliation Gate:** The events are parked with an approval status of `PENDING_REVIEW`. They do not yet affect active inventory.
4. **Human Review:** The unblinded pharmacist or authorized coordinator reviews the ingested events against the source document (preserving row-level provenance).
5. **Ledger Commit:** The pharmacist approves the events. They transition to `APPROVED`.
6. **State Projection:** The `InventoryStateEngine` aggregates all `APPROVED` events to project the current physical count and status of the IP.

## 4. Guardrails
- **No Direct Mutation:** The `InventoryState` object cannot be edited directly via a UI form. It is strictly a derived projection.
- **Row-Level Provenance:** Every event maintains pointers (`source_document_id`, `source_row`) to the exact upload that generated it.
- **Duplicate Detection:** The ingest engine hashes the row payload and source document to prevent double-counting a shipment if the same IRT report is uploaded twice.
- **Impossible Transitions:** The system blocks appending an `IP_DISPENSED` event if the prior state of the kit was `QUARANTINED` or `DESTROYED`.
