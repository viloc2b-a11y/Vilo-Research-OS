# Pharmacy Runtime Ledger Event Model

## 1. The Immutable Event Object
Every atomic action regarding Investigational Product (IP) is captured in a standardized event payload. This payload guarantees GCP compliance and robust ALCOA+ auditability.

```json
{
  "event_id": "uuid",
  "organization_id": "uuid",
  "study_id": "string",
  "site_id": "string",
  "kit_id": "string (nullable if bulk)",
  "lot_number": "string",
  "subject_id": "string (nullable)",
  "event_type": "ENUM",
  "event_time": "ISO8601 Timestamp",
  "quantity": "number",
  "unit": "string (e.g., vial, blister, mg)",
  "source_document_id": "uuid",
  "source_row": "integer",
  "source_evidence": "JSON Object",
  "actor_id": "uuid (Pharmacist/CRC)",
  "approval_status": "ENUM (PENDING_REVIEW, APPROVED, REJECTED, NEEDS_CLARIFICATION)",
  "created_at": "ISO8601 Timestamp"
}
```

## 2. Event Types Vocabulary

| Event Type | Trigger Condition |
|------------|-------------------|
| `IP_RECEIVED` | Site physical acceptance of a sponsor shipment via IRT. |
| `IP_RELEASED` | Authorized release of IP from quarantine back to active stock. |
| `IP_QUARANTINED` | IP isolated due to temp excursion, damage, or sponsor recall. |
| `IP_DISPENSED` | IP handed to a clinical subject. |
| `IP_ADMINISTERED` | IP actively consumed or injected by the subject on-site. |
| `IP_RETURNED` | Subject returns unused/empty IP to the pharmacy. |
| `IP_DESTROYED` | Authorized destruction of IP at the site level. |
| `IP_MISSING` | IP that cannot be physically located during an audit count. |
| `TEMP_EXCURSION` | Storage unit breaches min/max protocol boundaries. (Auto-triggers `IP_QUARANTINED` for all affected stock). |
| `SPONSOR_RELEASE` | Written permission from Sponsor to return quarantined IP to active status. (Required precursor to `IP_RELEASED`). |
| `INVENTORY_RECONCILIATION` | A formal audit event marking a 100% physical count match with the digital ledger. |
| `ACCOUNTABILITY_DISCREPANCY` | An explanatory event logging a mismatch (e.g., patient lost medication, dropped vial). |

## 3. Approval State Machine
All events enter the system as `PENDING_REVIEW` to isolate the ledger from erroneous or duplicate document uploads.
- `PENDING_REVIEW -> APPROVED`: Event is committed and now impacts the Inventory Projection.
- `PENDING_REVIEW -> REJECTED`: Event is discarded (e.g., duplicate upload).
- `PENDING_REVIEW -> NEEDS_CLARIFICATION`: Event parked for CRA/Sponsor querying.
