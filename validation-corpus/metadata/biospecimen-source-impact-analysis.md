# Biospecimen Source Impact & Runtime Analysis

## 1. Overview
Phase 4 analysis determines the structural runtime modules required to support the new Biospecimen Intelligence patterns. Currently, Vilo OS handles document intake. To support laboratory operations, the runtime must ingest tabular log data similar to the Pharmacy Runtime Ledger.

## 2. Required Biospecimen Runtime Modules

### 2.1 Universal Modules (Required for all trials)
- **Collection Log:** Tracks `subject_id`, `timepoint`, `collection_time`, `collector_id`.
- **Processing Log:** Tracks `centrifuge_start`, `centrifuge_end`, `processor_id`. This directly calculates *Time-to-Processing* deviations.
- **Storage Log:** Tracks transfer from centrifuge to freezer, logging the exact freezer shelf/box location.
- **Shipment Log:** Tracks `waybill_number`, `courier`, `dry_ice_weight`, and `shipment_date`.

### 2.2 Study-Dependent Modules
- **Aliquot Matrix Log:** Required only for biobanking trials. Maps primary tubes to 1..N child aliquots.
- **PK/PD Strict Timeline Engine:** A module that enforces exact minute-level countdowns (e.g., "+15m", "+30m", "+1hr" post-dose).

## 3. Event Sourcing Feasibility
Like the Pharmacy Ledger, the Biospecimen runtime should be **Event Sourced**.
**Events:**
- `SPECIMEN_COLLECTED`
- `SPECIMEN_PROCESSED`
- `SPECIMEN_STORED`
- `SPECIMEN_SHIPPED`
- `SPECIMEN_LOST`
- `SPECIMEN_DESTROYED`

**Projections:**
The current "Inventory" is the physical location of the specimen (e.g., "In -80C Freezer Box 2", or "In Transit to Covance Lab").

## 4. Conclusion
The Vilo OS platform must instantiate a **Biospecimen Operations Ledger** operating in parallel to the Pharmacy Runtime Ledger. The data schema is highly similar, though the RBAC model is simpler (no blinding/unblinding required for lab tech roles, unless handling PK data in an unblinded capacity).
