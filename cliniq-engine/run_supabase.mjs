import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import dotenv from "dotenv";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const STUDY_ID = process.env.STUDY_ID || "smoke-test-001";
const SOA_PATH = path.join(__dirname, "mock_soa.csv");
const DATABASE_URL =
  process.env.CLINIQ_DATABASE_URL ||
  "postgres://postgres:postgres@127.0.0.1:54322/postgres";

const sql = postgres(DATABASE_URL, {
  connect_timeout: 5,
  max: 1,
});

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = lines.shift().split(",").map((header) => header.trim());
  return lines.map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });
    return row;
  });
}

function toBillable(row) {
  const quantity = Number(row.quantity);
  const unitCost = Number(row.unit_cost);
  return {
    id: crypto.randomUUID(),
    study_id: row.study_id,
    visit_name: row.visit_name,
    activity_id: row.activity_id,
    activity_type: row.activity_type,
    quantity,
    unit_cost: unitCost,
    billable_to: row.billable_to,
    status: "pending",
    amount: quantity * unitCost,
  };
}

async function bootstrapSchema() {
  await sql.unsafe(`
    create extension if not exists pgcrypto;
    drop view if exists leakage_summary cascade;
    drop table if exists visit_log cascade;
    drop table if exists expected_billables cascade;
    drop table if exists cliniq_events cascade;

    create table cliniq_events (
      id uuid primary key default gen_random_uuid(),
      event_type text not null,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table expected_billables (
      id uuid primary key default gen_random_uuid(),
      study_id text not null,
      visit_name text not null,
      activity_id text not null,
      activity_type text not null,
      quantity numeric(10,4) not null,
      unit_cost numeric(10,2) not null,
      billable_to text not null,
      status text not null default 'pending'
        check (status in ('pending', 'triggered', 'billed', 'waived')),
      triggered_at timestamptz,
      created_at timestamptz not null default now(),
      unique(study_id, visit_name, activity_id)
    );

    create table visit_log (
      id uuid primary key default gen_random_uuid(),
      study_id text not null,
      visit_name text not null,
      completed_by text not null default 'system',
      completed_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );

    create or replace view leakage_summary as
      select
        study_id,
        visit_name,
        activity_id,
        activity_type,
        quantity * unit_cost as amount,
        billable_to,
        created_at
      from expected_billables
      where status = 'pending'
      order by created_at desc;

    create index if not exists idx_events_type on cliniq_events (event_type);
    create index if not exists idx_events_study on cliniq_events ((payload->>'study_id'));
    create index if not exists idx_events_created on cliniq_events (created_at desc);
    create index if not exists idx_billables_study on expected_billables (study_id);
    create index if not exists idx_billables_status on expected_billables (status);
    create index if not exists idx_visitlog_study on visit_log (study_id);
  `);
}

async function appendEvent(eventType, payload) {
  await sql`
    insert into cliniq_events (
      id, event_type, payload, created_at
    ) values (
      ${crypto.randomUUID()},
      ${eventType},
      ${payload},
      ${new Date().toISOString()}
    )
  `;
}

async function upsertBillable(billable) {
  await sql`
    insert into expected_billables (
      id,
      study_id,
      visit_name,
      activity_id,
      activity_type,
      quantity,
      unit_cost,
      billable_to,
      status
    ) values (
      ${billable.id},
      ${billable.study_id},
      ${billable.visit_name},
      ${billable.activity_id},
      ${billable.activity_type},
      ${billable.quantity},
      ${billable.unit_cost},
      ${billable.billable_to},
      ${billable.status}
    )
    on conflict (study_id, visit_name, activity_id)
    do update set
      activity_type = excluded.activity_type,
      quantity = excluded.quantity,
      unit_cost = excluded.unit_cost,
      billable_to = excluded.billable_to,
      status = excluded.status
  `;
}

async function getPendingBillables(studyId) {
  return sql`
    select *
    from expected_billables
    where study_id = ${studyId} and status = 'pending'
    order by created_at
  `;
}

async function markBillableTriggered(studyId, visitName, activityId) {
  await sql`
    update expected_billables
    set status = 'triggered',
        triggered_at = ${new Date().toISOString()}
    where study_id = ${studyId}
      and visit_name = ${visitName}
      and activity_id = ${activityId}
  `;
}

async function getLeakageSummary(studyId) {
  return sql`
    select *
    from leakage_summary
    where study_id = ${studyId}
    order by created_at desc
  `;
}

async function getAllEvents() {
  return sql`
    select *
    from cliniq_events
    order by created_at
  `;
}

async function clearStudyState(studyId) {
  await sql`
    delete from cliniq_events
    where payload->>'study_id' = ${studyId}
  `;
  await sql`
    delete from visit_log
    where study_id = ${studyId}
  `;
  await sql`
    delete from expected_billables
    where study_id = ${studyId}
  `;
}

async function main() {
  console.log("=== ClinIQ Supabase Smoke Test ===\n");
  console.log(`[0] Using ${DATABASE_URL}`);

  try {
    await bootstrapSchema();
    await clearStudyState(STUDY_ID);

    const soaText = fs.readFileSync(SOA_PATH, "utf8");
    const rows = parseCsv(soaText);
    const billables = rows.map((row) => {
      const billable = toBillable(row);
      billable.study_id = STUDY_ID;
      return billable;
    });
    const totalValue = billables.reduce((sum, billable) => sum + billable.amount, 0);

    console.log(`[1] Parsed ${billables.length} billables from ${path.basename(SOA_PATH)}`);
    await appendEvent("expected_billables_generated", {
      study_id: STUDY_ID,
      total_items: billables.length,
      total_value: totalValue,
    });

    for (const billable of billables) {
      await upsertBillable(billable);
    }
    console.log(`[2] Seeded into expected_billables`);

    for (const visitName of ["Screening Visit", "Baseline Visit"]) {
      const pending = await getPendingBillables(STUDY_ID);
      const visitPending = pending.filter((row) => row.visit_name === visitName);

      for (const row of visitPending) {
        await markBillableTriggered(STUDY_ID, visitName, row.activity_id);
        await appendEvent("billable_triggered", {
          study_id: STUDY_ID,
          visit_name: visitName,
          activity_id: row.activity_id,
          amount: Number(row.quantity) * Number(row.unit_cost),
          billable_to: row.billable_to,
        });
      }

      await sql`
        insert into visit_log (study_id, visit_name, completed_by)
        values (${STUDY_ID}, ${visitName}, ${"smoke"})
      `;
      await appendEvent("visit_completed", {
        study_id: STUDY_ID,
        visit_name: visitName,
        triggered_count: visitPending.length,
      });

      console.log(`[3] ${visitName}: triggered ${visitPending.length} item(s)`);
    }

    const leakage = await getLeakageSummary(STUDY_ID);
    console.log(`[4] Leakage: ${leakage.length} pending item(s)`);
    for (const row of leakage) {
      console.log(
        `    !! ${row.visit_name} | ${row.activity_id} | $${Number(row.amount).toFixed(2)}`
      );
    }

    const events = await getAllEvents();
    const mine = events.filter((event) => event.payload?.study_id === STUDY_ID);
    console.log(`[5] ${mine.length} event(s) logged for ${STUDY_ID}`);
    console.log("\n=== Done ===");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
