import { InventoryState, KitState, PharmacyRole } from "./inventory-state-types";
import { PharmacyEvent, PharmacyEventType } from "./pharmacy-event-types";

/**
 * Validates the core ALCOA+ accountability equation for the site.
 */
export function validateAccountabilityEquation(state: InventoryState): boolean {
  const sumOfParts = 
    state.available + 
    state.dispensed + 
    state.administered + 
    state.returned + 
    state.destroyed + 
    state.quarantined + 
    state.missing + 
    state.unreconciled;
    
  return state.total_received === sumOfParts;
}

/**
 * Validates allowable Kit State transitions based on operational logic.
 */
export function validateStateTransition(event: PharmacyEvent, currentState: InventoryState): boolean {
  if (!event.kit_id) return true;
  
  const currentKitState = currentState.kit_states[event.kit_id] || KitState.EXPECTED;
  
  switch (event.event_type) {
    case PharmacyEventType.IP_RECEIVED:
      return currentKitState === KitState.EXPECTED;

    case PharmacyEventType.IP_QUARANTINED:
      return currentKitState === KitState.AVAILABLE || 
             currentKitState === KitState.RECEIVED ||
             currentKitState === KitState.DISPENSED; // Post-dispense recalls

    case PharmacyEventType.IP_RELEASED:
      return currentKitState === KitState.QUARANTINED;

    case PharmacyEventType.IP_DISPENSED:
      return currentKitState === KitState.AVAILABLE;

    case PharmacyEventType.IP_ADMINISTERED:
      return currentKitState === KitState.DISPENSED;

    case PharmacyEventType.IP_RETURNED:
      return currentKitState === KitState.DISPENSED || 
             currentKitState === KitState.ADMINISTERED;

    case PharmacyEventType.IP_DESTROYED:
      return currentKitState === KitState.RETURNED || 
             currentKitState === KitState.QUARANTINED || 
             currentKitState === KitState.EXPIRED;

    case PharmacyEventType.IP_MISSING:
      return currentKitState !== KitState.DESTROYED && 
             currentKitState !== KitState.ADMINISTERED;

    default:
      return true;
  }
}
