import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highestPriorityDispensingAction } from "../lib/pharmacy-runtime/dispensing/command-center";
import type { DispensingCommandCenterItem } from "../lib/pharmacy-runtime/dispensing/types";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0161_pharmacy_dispensing_runtime.sql"),
  "utf8",
);

assert.match(migration, /pharmacy_subject_assignments/);
assert.match(migration, /ip_dispensations/);
assert.match(migration, /ip_administration_events/);
assert.match(migration, /ip_dispensation_review_confirmations/);
assert.match(migration, /ip_dispensation_command_center_actions/);
assert.match(migration, /ip_administration_event/);
assert.equal(migration.includes("user.is_unblinded"), false);
assert.equal(migration.includes("update public.ip_kits"), false);

for (const file of [
  "blueprint-rules.ts",
  "subject-assignment.ts",
  "dispensing-runtime.ts",
  "administration-event.ts",
  "review-confirmation.ts",
  "command-center.ts",
]) {
  const text = readFileSync(join(process.cwd(), "lib/pharmacy-runtime/dispensing", file), "utf8");
  assert.equal(text.includes("user.is_unblinded"), false, `${file} must not use global unblinded flags`);
  assert.equal(text.includes("Pharmacy Review Queue"), false, `${file} must not introduce independent review queues`);
  assert.equal(text.includes("update public.ip_kits"), false, `${file} must not mutate kit status`);
}

const actions: DispensingCommandCenterItem[] = [
  {
    subjectId: "subject",
    visitInstanceId: "visit",
    procedureInstanceId: "procedure",
    dispensationId: "disp",
    reviewConfirmationId: "review-1",
    actionRequired: "Review Dispensation",
    executionMode: "asynchronous_required",
    dueAt: null,
  },
  {
    subjectId: "subject",
    visitInstanceId: "visit",
    procedureInstanceId: "procedure",
    dispensationId: "disp",
    reviewConfirmationId: "review-2",
    actionRequired: "Review Overdue",
    executionMode: "asynchronous_required",
    dueAt: new Date().toISOString(),
  },
];

assert.equal(highestPriorityDispensingAction(actions)?.actionRequired, "Review Overdue");

console.log("Pharmacy Dispensing Runtime smoke passed.");
