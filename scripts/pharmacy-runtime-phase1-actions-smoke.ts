import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIpCorrectionPreview } from "../lib/pharmacy-runtime/actions/corrections";
import { createIpReceiptPreview } from "../lib/pharmacy-runtime/actions/receipts";
import { PharmacyRuntimeBlueprint } from "../lib/pharmacy-runtime/phase1-domain";

const blueprint: PharmacyRuntimeBlueprint = {
  blueprint_id: "11111111-1111-4111-8111-111111111111",
  organization_id: "22222222-2222-4222-8222-222222222222",
  study_id: "33333333-3333-4333-8333-333333333333",
  site_id: "44444444-4444-4444-8444-444444444444",
  source: "DOCUMENT_READER",
  document_center_id: "55555555-5555-4555-8555-555555555555",
  document_reader_run_id: "66666666-6666-4666-8666-666666666666",
  crc_review_completed: true,
  activation_status: "active",
  activated_at: "2026-05-31T12:00:00.000Z",
  activated_by: "77777777-7777-4777-8777-777777777777",
};

const receiptPreview = createIpReceiptPreview({
  receipt_id: "88888888-8888-4888-8888-888888888888",
  shipment_id: "99999999-9999-4999-8999-999999999999",
  organization_id: blueprint.organization_id,
  study_id: blueprint.study_id,
  site_id: blueprint.site_id,
  received_by: "77777777-7777-4777-8777-777777777777",
  occurred_at: "2026-05-31T12:05:00.000Z",
  recorded_at: "2026-05-31T12:06:00.000Z",
  document_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  blueprint,
  expectations: [
    {
      expectation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      blueprint_id: blueprint.blueprint_id,
      shipment_id: "99999999-9999-4999-8999-999999999999",
      lot_number: "LOT-A",
      kit_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      expected_quantity: 1,
      expected_condition: "intact",
      expected_location_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      source: "ACTIVATED_BLUEPRINT",
    },
  ],
  items: [
    {
      expectation_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      kit_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      lot_number: "LOT-A",
      received_quantity: 1,
      condition: "intact",
      location_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    },
  ],
});

assert.equal(receiptPreview.willPersist, false);
assert.equal(receiptPreview.eventCount, 2);
assert.equal(
  receiptPreview.events.every((event) => event.signature_id === "PREVIEW_SIGNATURE_NOT_COMMITTED"),
  true,
);

const correctionPreview = createIpCorrectionPreview({
  correction_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  target_event: receiptPreview.events[0],
  corrected_event: {
    ...receiptPreview.events[0],
    location_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    payload: {
      ...receiptPreview.events[0].payload,
      corrected_location_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    },
  },
  scope: "receipt_event",
  reason: "Correct location.",
  justification: "Preview-only correction for action smoke.",
  corrected_by: "77777777-7777-4777-8777-777777777777",
  corrected_at: "2026-05-31T12:10:00.000Z",
  document_ids: ["abababab-abab-4aba-8aba-abababababab"],
});

assert.equal(correctionPreview.willPersist, false);
assert.equal(correctionPreview.eventCount, 2);
assert.equal(correctionPreview.events[0].event_type, "receipt_reversed");
assert.equal(correctionPreview.events[1].supersedes_event_id, receiptPreview.events[0].event_id);

for (const file of [
  "access.ts",
  "blueprints.ts",
  "receipts.ts",
  "corrections.ts",
  "ledger-commit.ts",
  "document-links.ts",
]) {
  const text = readFileSync(join(process.cwd(), "lib/pharmacy-runtime/actions", file), "utf8");
  assert.equal(text.includes("user.is_unblinded"), false, `${file} must not use user.is_unblinded`);
}

for (const file of ["receipts.ts", "corrections.ts", "ledger-commit.ts"]) {
  const text = readFileSync(join(process.cwd(), "lib/pharmacy-runtime/actions", file), "utf8");
  assert.equal(text.includes(".from('ip_receipts')"), false, `${file} must not directly write receipt rows`);
  assert.equal(text.includes(".from('ip_receipt_items')"), false, `${file} must not directly write receipt item rows`);
  assert.equal(text.includes(".from('ip_corrections')"), false, `${file} must not directly write correction rows`);
  assert.equal(text.includes(".from('ip_ledger_events')"), false, `${file} must not directly write ledger rows`);
  assert.equal(text.includes(".from('ip_document_links')"), false, `${file} must not directly write document link rows`);
}

console.log("Pharmacy Runtime Phase 1 actions smoke passed.");
