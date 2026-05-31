import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plain objects instead of enums to avoid Node strip-types issues
const PharmacyEventType = {
  IP_RECEIVED: "IP_RECEIVED",
  IP_RELEASED: "IP_RELEASED",
  IP_QUARANTINED: "IP_QUARANTINED",
  IP_DISPENSED: "IP_DISPENSED",
  IP_ADMINISTERED: "IP_ADMINISTERED",
  IP_RETURNED: "IP_RETURNED",
  IP_DESTROYED: "IP_DESTROYED",
  IP_MISSING: "IP_MISSING",
  TEMP_EXCURSION: "TEMP_EXCURSION",
  ACCOUNTABILITY_DISCREPANCY: "ACCOUNTABILITY_DISCREPANCY"
};

const EventApprovalStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};

const KitState = {
  EXPECTED: "EXPECTED",
  RECEIVED: "RECEIVED",
  AVAILABLE: "AVAILABLE",
  QUARANTINED: "QUARANTINED",
  DISPENSED: "DISPENSED",
  RETURNED: "RETURNED"
};

// Ensure directories exist
const outDir = path.resolve(__dirname, '../validation-corpus/pharmacy-runtime/simulation-output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const inDir = path.resolve(__dirname, '../validation-corpus/pharmacy-runtime/sample-inputs');

let events: any[] = [];
let eventIdCounter = 1;

function generateId() {
  return `EVT-${String(eventIdCounter++).padStart(4, '0')}`;
}

// 1. Parse Receipts
const receiptCsv = fs.readFileSync(path.join(inDir, 'ip-receipt-log.csv'), 'utf8');
receiptCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [kit_id, lot_number, quantity, date_received] = line.split(',');
  events.push({
    event_id: generateId(),
    kit_id,
    lot_number,
    event_type: PharmacyEventType.IP_RECEIVED,
    event_time: date_received,
    quantity: parseInt(quantity),
    approval_status: EventApprovalStatus.PENDING_REVIEW
  });
});

// 2. Parse Excursions (LOT-B on May 5th)
const excursionCsv = fs.readFileSync(path.join(inDir, 'temp-excursion-log.csv'), 'utf8');
excursionCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [lot_number, date_excursion, temp] = line.split(',');
  
  // Create excursion event
  events.push({
    event_id: generateId(),
    kit_id: null,
    lot_number,
    event_type: PharmacyEventType.TEMP_EXCURSION,
    event_time: date_excursion,
    quantity: 0,
    approval_status: EventApprovalStatus.PENDING_REVIEW
  });
  
  // Find all kits in this lot and quarantine them
  events.filter(e => e.lot_number === lot_number && e.event_type === PharmacyEventType.IP_RECEIVED)
    .forEach(e => {
       events.push({
         event_id: generateId(),
         kit_id: e.kit_id,
         lot_number,
         event_type: PharmacyEventType.IP_QUARANTINED,
         event_time: date_excursion,
         quantity: e.quantity,
         approval_status: EventApprovalStatus.PENDING_REVIEW
       });
    });
});

// 3. Parse Dispensing
const dispenseCsv = fs.readFileSync(path.join(inDir, 'irt-dispensing-log.csv'), 'utf8');
dispenseCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [kit_id, subject_id, date_dispensed] = line.split(',');
  
  // Find lot number for this kit
  const receipt = events.find(e => e.kit_id === kit_id && e.event_type === PharmacyEventType.IP_RECEIVED);
  const lot_number = receipt ? receipt.lot_number : 'UNKNOWN';

  events.push({
    event_id: generateId(),
    kit_id,
    lot_number,
    subject_id,
    event_type: PharmacyEventType.IP_DISPENSED,
    event_time: date_dispensed,
    quantity: 1,
    approval_status: EventApprovalStatus.PENDING_REVIEW
  });
});

// 4. Parse Returns
const returnCsv = fs.readFileSync(path.join(inDir, 'ip-return-log.csv'), 'utf8');
returnCsv.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const [kit_id, subject_id, quantity_returned, date_returned] = line.split(',');
  
  events.push({
    event_id: generateId(),
    kit_id,
    lot_number: 'UNKNOWN',
    subject_id,
    event_type: PharmacyEventType.IP_RETURNED,
    event_time: date_returned,
    quantity: parseInt(quantity_returned),
    approval_status: EventApprovalStatus.PENDING_REVIEW
  });
});

// SORT EVENTS CHRONOLOGICALLY
events.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());

// STATE PROJECTION (Inventory Ledger)
let inventoryState: any = {
  total_received: 0,
  available: 0,
  dispensed: 0,
  returned: 0,
  quarantined: 0,
  unreconciled: 0,
  kit_states: {} // kit_id -> KitState
};

// HARD STOP SIMULATION LOG
let hardStopLog: any[] = [];

// PROCESS EVENTS (Simulate Human Approval -> Projection)
events.forEach(evt => {
  let currentState = inventoryState.kit_states[evt.kit_id] || KitState.EXPECTED;
  
  // Validate state transitions (Hard Stops)
  let allowed = true;
  let reason = '';
  
  if (evt.event_type === PharmacyEventType.IP_DISPENSED) {
    if (currentState === KitState.QUARANTINED) {
      allowed = false;
      reason = "Cannot dispense a quarantined kit.";
    } else if (currentState === KitState.DISPENSED) {
      allowed = false;
      reason = "Cannot dispense an already dispensed kit.";
    } else if (currentState === KitState.EXPECTED) {
      allowed = false;
      reason = "Cannot dispense a kit that was never received.";
    }
  }
  
  if (!allowed) {
    evt.approval_status = EventApprovalStatus.REJECTED;
    hardStopLog.push({ event_id: evt.event_id, kit_id: evt.kit_id, reason });
    return; // Skip projection
  }
  
  // Approve event
  evt.approval_status = EventApprovalStatus.APPROVED;
  
  // Project State
  if (evt.event_type === PharmacyEventType.IP_RECEIVED) {
    inventoryState.kit_states[evt.kit_id] = KitState.AVAILABLE;
    inventoryState.total_received += evt.quantity;
    inventoryState.available += evt.quantity;
  }
  if (evt.event_type === PharmacyEventType.IP_QUARANTINED && evt.kit_id) {
    inventoryState.kit_states[evt.kit_id] = KitState.QUARANTINED;
    inventoryState.available -= evt.quantity;
    inventoryState.quarantined += evt.quantity;
  }
  if (evt.event_type === PharmacyEventType.IP_DISPENSED) {
    inventoryState.kit_states[evt.kit_id] = KitState.DISPENSED;
    inventoryState.available -= evt.quantity;
    inventoryState.dispensed += evt.quantity;
  }
  if (evt.event_type === PharmacyEventType.IP_RETURNED) {
    inventoryState.kit_states[evt.kit_id] = KitState.RETURNED;
    inventoryState.dispensed -= evt.quantity;
    inventoryState.returned += evt.quantity;
  }
});

// Write outputs
fs.writeFileSync(path.join(outDir, 'pharmacy-events.json'), JSON.stringify(events, null, 2));

const finalOutput = {
  inventory_state: inventoryState,
  accountability_equation_balanced: (inventoryState.total_received === (inventoryState.available + inventoryState.dispensed + inventoryState.returned + inventoryState.quarantined)),
  hard_stops_triggered: hardStopLog
};

fs.writeFileSync(path.join(outDir, 'inventory-state.json'), JSON.stringify(finalOutput, null, 2));

console.log("Simulation complete. Hard stops triggered:", hardStopLog.length);
