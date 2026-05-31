# Pharmacy Runtime Phase 1 Build Plan

## Phase 1 Scope

Phase 1 builds the Pharmacy / IP Accountability runtime foundation without implementing the full visit dispensing workflow. The goal is to make IP inventory accountable from the first shipment receipt, prove the immutable ledger pattern, and establish the access, signature, and document hooks that later workflows will reuse.

Included:

- Core IP domain model for studies, sites, lots, kits, shipments, receipt records, locations, and ledger events.
- INSERT-only IP ledger foundation with derived inventory state.
- Receipt workflow for expected shipments, received quantities, kit condition, discrepancy capture, quarantine routing, and signature.
- Correction/reversal model for receipt and inventory transcription errors.
- Basic unblinded access controls and masking boundaries.
- Operational signature requirements for receipt and correction.
- Document Center dependency hooks for shipment documents, receipt evidence, and correction support.
- Coordinator Simplicity First UI: CRC-facing flows should present guided operational steps, not raw ledger mechanics.
- Activation dependency chain: Document Center -> Document Reader -> Pharmacy Runtime Blueprint -> CRC Review -> Activation.

Phase 1 receipt expectations must come from activated blueprint/document-derived inputs. Manual kit or workflow configuration is not the default path; manual entry is allowed only as an exception workflow with justification and audit trail.

Deferred from Phase 1:

- Dispense, return, destruction, reconciliation PDF generation, external IRT/RTSM integration, barcode scanning, temperature logs, automated resupply, and advanced analytics.

## Proposed Files

Planning-only target files for implementation handoff:

- `directivas/pharmacy_runtime_phase_1_build_plan.md` - this build plan.

Expected implementation files once build begins:

- `lib/pharmacy/ip-types.ts` - shared TypeScript domain types and enums.
- `lib/pharmacy/ip-ledger.ts` - ledger event builders, validation, and derived-state calculators.
- `lib/pharmacy/ip-access.ts` - role checks, unblinded guards, and masking helpers.
- `lib/pharmacy/ip-receipts.ts` - receipt workflow orchestration helpers.
- `lib/pharmacy/ip-corrections.ts` - reversal and superseding event helpers for receipt, inventory foundation, and accountability foundation events only.
- `app/actions/pharmacy-ip.ts` - server actions for receipt, correction, and inventory queries.
- `components/pharmacy/ReceiptWorkspace.tsx` - guided shipment receipt surface.
- `components/pharmacy/InventorySnapshot.tsx` - derived inventory display.
- `components/pharmacy/CorrectionDialog.tsx` - correction/reversal capture.
- `components/pharmacy/MaskedIpBadge.tsx` - blinded-safe display primitive.
- `components/document-center/PharmacyDocumentHooks.tsx` or equivalent existing integration point - dependency hooks only.
- `validation-corpus/metadata/pharmacy_ip_phase_1_acceptance.json` - optional metadata fixture for acceptance validation.

No migrations should be created until this plan is approved.

## Data Model Needed

Phase 1 needs the following conceptual tables/entities when implementation starts:

- `ip_lots`
  - Study/site scoped manufacturer lot record.
  - Fields: `id`, `study_id`, `site_id`, `manufacturer_lot_number`, `expiry_date`, `status`, `created_at`, `created_by`.
  - Status: `created`, `active`, `expired`, `quarantined`.

- `ip_kits`
  - Minimum accountable unit.
  - Fields: `id`, `study_id`, `site_id`, `lot_id`, `kit_number`, `kit_label`, `blinding_group` or masked treatment metadata if applicable, `created_at`.
  - Operational state must be derived from ledger events, not directly mutated.

- `ip_shipments`
  - Depot shipment envelope.
  - Fields: `id`, `study_id`, `site_id`, `shipment_number`, `expected_arrival_date`, `status`, `source`, `created_at`.
  - Status: `in_transit`, `received`, `received_with_discrepancy`, `cancelled`.
  - Source must trace back to an activated Pharmacy Runtime Blueprint derived from Document Center / Document Reader inputs.

- `ip_shipment_items`
  - Expected lot/kit contents for a shipment.
  - Fields: `id`, `shipment_id`, `lot_id`, `kit_id`, `expected_quantity`, `expected_condition`.
  - Default creation path is blueprint-derived activation, not manual configuration.

- `ip_inventory_locations`
  - Simple physical storage locations.
  - Fields: `id`, `study_id`, `site_id`, `name`, `status`, `created_at`.
  - Keep simple: no nested warehouse model in Phase 1.

- `ip_receipts`
  - Receipt workflow header.
  - Fields: `id`, `shipment_id`, `study_id`, `site_id`, `received_at`, `received_by`, `status`, `discrepancy_summary`, `signature_id`, `document_bundle_id`.
  - Status: `pending_verification`, `verified`, `quarantined`, `corrected`.

- `ip_receipt_items`
  - Physical verification result per kit or lot line.
  - Fields: `id`, `receipt_id`, `kit_id`, `lot_id`, `location_id`, `received_quantity`, `condition`, `is_discrepant`, `discrepancy_reason`.

- `ip_ledger_events`
  - Immutable event stream.
  - Fields: `id`, `study_id`, `site_id`, `event_type`, `event_version`, `occurred_at`, `recorded_at`, `recorded_by`, `source_entity_type`, `source_entity_id`, `kit_id`, `lot_id`, `location_id`, `quantity_delta`, `status_delta`, `payload_json`, `reverses_event_id`, `supersedes_event_id`, `signature_id`, `record_hash`.
  - INSERT-only. No update/delete path for signed events.

- `ip_corrections`
  - Correction workflow header for audit readability.
  - Fields: `id`, `study_id`, `site_id`, `target_event_id`, `reversal_event_id`, `superseding_event_id`, `reason`, `justification`, `requested_by`, `approved_by`, `signature_id`, `created_at`.
  - Phase 1 correction scope is limited to receipt events, inventory foundation events, and accountability foundation events.
  - Dispense correction, return correction, and destruction correction are out of scope until later phases.

- `ip_document_links`
  - Hook table or polymorphic association to Document Center.
  - Fields: `id`, `study_id`, `site_id`, `entity_type`, `entity_id`, `document_id`, `document_role`, `created_at`, `created_by`.

Inventory position must be computed from `ip_ledger_events`; do not persist kit operational state as the source of truth.

## Ledger Events

Phase 1 ledger event types:

- `shipment_expected`
  - Optional seed event when shipment contents are registered from an activated Pharmacy Runtime Blueprint.
  - No inventory delta.

- `receipt_verified`
  - Adds verified physical stock.
  - `quantity_delta`: positive.
  - Kit status becomes `available` when condition is acceptable.

- `receipt_quarantined`
  - Adds physical stock into quarantine.
  - `quantity_delta`: positive.
  - Kit status becomes `quarantined`.

- `receipt_discrepancy_recorded`
  - Captures missing, damaged, extra, or mismatched shipment contents.
  - May create zero inventory delta for missing expected stock, or quarantine delta for physically present but unusable stock.

- `inventory_location_assigned`
  - Assigns received kit/lot to a storage location.
  - No net inventory delta; location becomes part of derived inventory grouping.

- `receipt_reversed`
  - Logical reversal of a prior receipt event.
  - Must reference `reverses_event_id`.
  - Mirrors the original event mathematically with opposite delta where applicable.

- `receipt_superseded`
  - Corrected replacement event.
  - Must reference `supersedes_event_id` or correction group metadata.
  - Requires same correction signature as the reversal pair.

- `kit_quarantined`
  - Moves a kit into quarantine due to damage, mismatch, expiry, or discrepancy.
  - No net quantity change; derived status changes.

Ledger rules:

- Events are append-only.
- Corrections are represented by reversal plus superseding event, never mutation.
- Phase 1 correction/reversal applies only to receipt events, inventory foundation events, and accountability foundation events.
- Dispense, return, and destruction correction are not Phase 1 ledger behaviors.
- All signed event payloads must be hashable and stable.
- Server time is authoritative for `recorded_at`.
- User-entered event dates may be captured separately as `occurred_at`, with audit trail.
- Derived inventory must ignore reversed mathematical effects and include superseding effects.

## Server Actions Needed

Phase 1 server actions:

- `getPharmacyShipmentReceiptWorkspace(studyId, siteId, shipmentId)`
  - Returns expected shipment, receipt status, blueprint activation status, document hooks, role permissions, and derived inventory context.

- `createIpReceiptDraft(input)`
  - Starts a receipt workflow without signing final inventory events.
  - Validates study/site scope, role, shipment status, document dependencies, and active blueprint gate.
  - Blocks default manual kit/workflow configuration unless an exception path is explicitly invoked.

- `verifyIpReceipt(input, signatureChallenge)`
  - Signs and commits receipt ledger events.
  - Creates `receipt_verified`, `receipt_quarantined`, `receipt_discrepancy_recorded`, and location assignment events as needed.
  - Requires active Pharmacy Runtime Blueprint, completed CRC review, and `activation status = active`.

- `getDerivedIpInventory(studyId, siteId, filters)`
  - Computes inventory from ledger events.
  - Applies masking based on current user role.

- `getIpLedgerAuditTrail(studyId, siteId, entityRef)`
  - Returns ledger history for unblinded roles and masked audit summaries for blinded roles.

- `createIpReceiptCorrectionDraft(input)`
  - Loads target event, calculates proposed reversal/superseding effects, and requires a reason.
  - Accepts only receipt, inventory foundation, or accountability foundation target events in Phase 1.

- `signIpReceiptCorrection(input, signatureChallenge)`
  - Commits reversal and superseding events as one atomic operation with one operational signature.
  - Rejects dispense, return, or destruction correction targets in Phase 1.

- `linkIpDocument(input)`
  - Associates Document Center artifacts with shipments, receipts, or corrections.

All server actions must enforce role, study, and site authorization server-side. UI hiding is not sufficient.

## UI Surfaces Needed

Phase 1 UI should be operational and boring in the best possible way:

- Receipt Work Queue
  - Shows pending receipts, quarantined receipt issues, low-level inventory counts, and recent correction activity.
  - Does not expose raw ledger as the default CRC experience.
  - Must remain a focused operational queue, not a new command center or excessive dashboard surface.

- Receipt Workspace
  - Guided checklist:
    - Confirm shipment identity.
    - Confirm expectations sourced from active Pharmacy Runtime Blueprint.
    - Verify received kits/lots.
    - Mark condition.
    - Choose storage location.
    - Attach or confirm required documents.
    - Sign receipt.
  - Supports `Verified` and `Received with Discrepancy`.
  - Manual entry is exception-only and must capture reason, source, and audit trail.

- Inventory Snapshot
  - Derived counts by lot, location, status, and expiry.
  - Unblinded users see kit and lot identifiers.
  - Blinded users see only safe aggregate signals where allowed.

- Correction Dialog
  - Starts from a specific receipt or ledger event.
  - Shows original value, reversal effect, corrected value, reason, justification, and signature prompt.
  - History must show the original event as reversed but legible.

- Masked IP Display Primitive
  - Shared component for any surface that may be shown to blinded users.
  - Prevents accidental kit/lot leakage.

- Document Hook Panel
  - Shows required shipment/receipt/correction documents and linked evidence.
  - No full Document Center rebuild in Phase 1.

Coordinator Simplicity First requirements:

- Primary receipt action should read like “Receive Shipment,” not “Create Ledger Event.”
- Ledger details belong behind an audit/details affordance for authorized users.
- Discrepancy capture should be reason-based, not JSON/payload based.
- Correction flow should explain operational impact in plain language before signing.
- Do not create a new command center, excessive dashboards, or alert-heavy inventory console in Phase 1.

## Signature Integration

Phase 1 must use the existing Operational Signature Engine pattern.

Receipt signature:

- Required for final receipt verification.
- Single signature by `unblinded_coordinator` or equivalent authorized unblinded site role.
- Meaning: “I verified the physical investigational product received and confirm this receipt record is accurate.”
- Signature payload must include shipment ID, receipt ID, item summaries, discrepancies, document links, timestamp, signer identity, and hash.

Correction signature:

- Required for reversal/superseding correction pair.
- Single signature by `unblinded_coordinator` or PI only when policy allows PI unblinded correction authority.
- Meaning: “I certify the prior IP receipt/accountability record was entered in error and this correction is accurate.”
- Signature payload must include original event ID, reversal event payload, superseding event payload, reason, justification, timestamp, signer identity, and hash.

Signature guardrails:

- Signed payloads are immutable.
- Signature IDs are stored on the receipt/correction header and each committed ledger event.
- Secondary authentication/PIN must happen before commit.
- Failed signature must leave no committed ledger events.
- Signature timestamp must come from the server.

## Document Center Integration

Phase 1 should add dependency hooks only:

Mandatory dependency chain:

Document Center
↓
Document Reader
↓
Pharmacy Runtime Blueprint
↓
CRC Review
↓
Activation

Activation gate:

- Pharmacy Runtime Phase 1 cannot activate for a study/site until a Pharmacy Runtime Blueprint exists.
- CRC review must be completed before activation.
- Activation status must be `active` before receipt expectations can drive signed receipt events.
- Phase 1 receipt expectations must come from activated blueprint/document-derived inputs.
- Manual kit/workflow configuration is not the default; manual entry is exception-only and must be justified, signed when applicable, and audit-visible.

- Shipment documents:
  - Packing slip.
  - Depot shipment notice.
  - Chain-of-custody evidence if available.

- Receipt documents:
  - Signed receipt confirmation.
  - Discrepancy photos or notes if available.
  - Quarantine evidence when applicable.

- Correction documents:
  - Source note or explanation.
  - Sponsor/site communication if applicable.
  - Supporting evidence for transcription error.

Integration behavior:

- Receipt workspace can show required/missing linked documents.
- Final receipt may allow signing with missing optional documents, but must clearly mark missing required evidence.
- Correction workflow must allow evidence attachment before signature.
- Document links must be included in the signed payload hash.
- Document Center remains the system of record for document storage; Pharmacy only owns associations and dependency checks.
- Pharmacy Runtime consumes document-derived blueprint outputs; it must not become a parallel manual configuration system for expected shipments, kits, or receipt workflow rules.

## Access Controls

Phase 1 access model:

- Unblinded Coordinator
  - Full create/read access for receipts, inventory, corrections, and unmasked ledger.
  - Can sign receipt and correction events.

- Blinded Coordinator
  - No access to kit numbers, lot numbers, treatment metadata, unmasked ledger, or unblinded inventory.
  - May see safe operational signals only, such as “Medication received” or “IP issue requires unblinded review,” if exposed outside pharmacy.

- PI
  - Blinded by default.
  - May approve deviations or corrections only through explicit policy and only with necessary unblinding controls.
  - Should not see kit/lot identifiers by accident.

- Monitor
  - Blinded read-only access to visit-safe outputs.
  - No unmasked shipment, kit, lot, or ledger access.

- Sponsor Monitor Unblinded
  - Read-only access to complete IP ledger and derived inventory.
  - Cannot create receipts or corrections.

Access control requirements:

- Unblinded masking and access control are hard activation gates, not UI preferences.
- Enforce RLS/server-side authorization for every action and query.
- Masking must happen before data reaches client components for blinded roles.
- Component-level masking is useful but cannot be the only defense.
- Audit all denied access attempts to unblinded IP resources.
- Treat kit number, lot number, shipment contents, treatment metadata, and ledger payload as unblinded-sensitive unless protocol explicitly marks open-label.
- Pharmacy receipt/correction actions must fail closed if role, site, study, blueprint activation, or masking policy cannot be resolved.

## Acceptance Criteria

Build is acceptable when:

- Core IP domain model is defined and approved before migrations are created.
- Pharmacy Runtime Blueprint exists, CRC review is completed, and activation status is `active`.
- Receipt expectations are sourced from activated blueprint/document-derived inputs.
- Manual kit/workflow configuration is exception-only and audit-visible, not the default path.
- Ledger event schema supports append-only receipt, quarantine, discrepancy, reversal, and superseding events.
- Inventory state can be derived from ledger events for available, quarantined, corrected, and discrepant receipt scenarios.
- No kit operational status is treated as mutable source of truth.
- Receipt workflow can commit signed ledger events atomically.
- Receipt discrepancy can create quarantine and discrepancy ledger entries without corrupting available inventory.
- Correction workflow creates reversal plus superseding events and never mutates signed historical records.
- One correction signature covers the reversal/superseding pair.
- Receipt and correction signatures include document links and stable payload hashes.
- Blinded users cannot retrieve kit IDs, lot numbers, treatment metadata, or raw ledger payloads from server actions.
- Unblinded access control and masking are enforced as hard gates before activation and before every server-side read/write.
- Unblinded sponsor monitor can read but not write ledger data.
- Document Center hooks exist for shipment, receipt, and correction evidence.
- UI keeps raw ledger secondary and presents CRC-friendly receipt/correction flows through a focused Receipt Work Queue.
- Tests or validation fixtures cover:
  - Normal receipt.
  - Receipt with damaged kit quarantined.
  - Receipt with missing expected kit.
  - Receipt correction for wrong location.
  - Receipt correction for wrong quantity.
  - Blinded access masking.
  - Sponsor monitor read-only behavior.
  - Failed signature rollback.

## Out of Scope

Phase 1 must not include:

- Dispense workflow.
- Dispense correction.
- Return workflow.
- Return correction.
- Destruction workflow or double-signature witness flow.
- Destruction correction.
- Subject assignment.
- Visit Workspace embedding beyond dependency awareness.
- Subject Command Center IP signals beyond planned hooks.
- Accountability Exception lifecycle beyond receipt discrepancy seed data.
- Reconciliation PDF generation.
- External IRT/RTSM integration.
- Temperature logging.
- Barcode scanning.
- Automated resupply.
- Multi-site depot logistics.
- Advanced pharmacy analytics.
- Production migrations before explicit approval.

## Final Verdict

READY TO BUILD

Phase 1 is ready to build as a foundation-only increment if implementation stays disciplined: establish the immutable ledger, receipt workflow, derived inventory, correction semantics, operational signatures, Document Center hooks, and unblinded access controls before adding dispensing or visit-runtime complexity.
