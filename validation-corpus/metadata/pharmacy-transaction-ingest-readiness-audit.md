# Pharmacy Transaction Ingest Readiness Audit

## 1. Overview
This audit evaluates the current Vilo OS `protocol-intake` codebase to determine if the system possesses the architectural capacity to ingest daily Pharmacy Runtime Transaction Logs (e.g., IRT Reports, Accountability Logs, Temp Excursion Logs) and normalize them into an immutable operational ledger.

## 2. Audit Findings

**1. Does current ingest support structured tabular logs?**
*No.* The `ViloReader` and `Docling` parsers are optimized for unstructured and semi-structured long-form documents (Protocols, IB, Manuals). They do not currently have adapters for row-by-row transactional CSVs, Excel files, or strict tabular log formats (like IRT dispensing reports).

**2. Does it distinguish protocol documents from operational transaction logs?**
*No.* The system categorizes intakes broadly via `ViloReaderMode` (VALIDATION vs PRODUCTION), but lacks an `IntakeType` discriminant (e.g., `PROTOCOL_DOCUMENT` vs `TRANSACTION_LOG`).

**3. Does it normalize rows into transaction events?**
*No.* The codebase contains no event normalization schema for pharmacy state events (`IP_RECEIVED`, `IP_RELEASED`, `IP_QUARANTINED`, `IP_DISPENSED`, `IP_ADMINISTERED`, `IP_RETURNED`, `IP_DESTROYED`, `IP_MISSING`, `TEMP_EXCURSION`, `SPONSOR_RELEASE`). 

**4. Does it preserve row-level provenance?**
*No.* While the current Parser preserves block-level provenance (e.g., "Page 42, Bounding Box X/Y"), it does not preserve row-level transactional lineage back to a specific upload payload (which is required for ALCOA+ ledger auditing).

**5. Does it support duplicate detection?**
*No.* The system checks idempotency at the Document/Artifact level using file hashes, but it does not have logic to detect if a specific dispensing event (e.g., "Kit 123 dispensed to Subject A") has already been ingested from a previous daily IRT report.

**6. Does it support ledger reconciliation?**
*No.* There is no mathematical ledger engine to compute `Dispensed - Returned = Amount Used` or `Total Received - Dispensed = On Hand`.

**7. Does it update inventory state?**
*No.* There is no `InventoryStore` or state-machine representing physical site inventory.

**8. Does it support quarantine state?**
*No.* The concept of an `IP_STATUS` enum (e.g., `ACTIVE`, `QUARANTINED`, `DESTROYED`) does not exist in the codebase.

**9. Does it prevent dispensing quarantined inventory?**
*No.* Because there is no inventory state or ledger, there are no software-level Hard Stops preventing a transaction from executing against a quarantined lot.

**10. Does it require human approval before ledger mutation?**
*No.* The `Coordinator Challenge / Reconciliation Gate` exists solely for Protocol Intelligence extraction approval. There is no `Transaction Reconciliation Gate` for approving operational log ingestions.

## 3. Final Assessment

**PHARMACY_TRANSACTION_INGEST: `NOT_READY`**

### Missing Components Required for Readiness:
To support transactional pharmacy runtime ingest, the following architecture must be built:
1. **Transaction Event Schema:** Define the core `PharmacyEvent` types (`IP_RECEIVED`, `TEMP_EXCURSION`, etc.).
2. **Tabular Ingest Adapter:** Build an ingest parser capable of mapping CSV/Excel columns (from IRT reports or temp loggers) to `PharmacyEvent` payloads.
3. **Ledger State Engine:** Create an immutable Event Sourcing ledger that calculates real-time inventory balances and states.
4. **Idempotency/Deduplication Engine:** Logic to prevent double-counting kits when overlapping weekly IRT reports are uploaded.
5. **Ledger Reconciliation Gate:** A UI workflow where the Unblinded Pharmacist reviews the ingested transactions and clicks "Approve & Mutate Ledger" (similar to the Protocol Intelligence reconciliation).
6. **Hard Stop Engine:** Middleware that queries the Ledger State before allowing an `IP_DISPENSED` event to be committed, blocking it if the Kit ID state is `QUARANTINED`.
