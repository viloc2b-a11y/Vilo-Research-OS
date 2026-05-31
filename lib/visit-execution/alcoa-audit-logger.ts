import { ALCOAAuditEvent } from "./visit-execution-types";
import { v4 as uuidv4 } from "uuid";

// This simulates inserting an ALCOA+ audit event to Supabase
export async function logALCOAEvent(
  visit_id: string,
  field_id: string,
  old_value: unknown,
  new_value: unknown,
  actor_id: string = "CRC-001"
): Promise<void> {
  const event: ALCOAAuditEvent = {
    id: uuidv4(),
    visit_instance_id: visit_id,
    field_id,
    old_value,
    new_value,
    actor_id,
    timestamp: new Date().toISOString()
  };

  // Simulated DB insertion; do not print clinical values to process logs.
  console.log(
    `[ALCOA+ AUDIT LOG] field change recorded event_id=${event.id} visit_id=${visit_id} field_id=${field_id} actor_id=${actor_id} had_old_value=${old_value != null} had_new_value=${new_value != null}`,
  );
}
