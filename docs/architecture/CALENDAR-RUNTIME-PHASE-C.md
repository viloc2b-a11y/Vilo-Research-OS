# Calendar Runtime Phase C

## Objective
Migrate resource-scoped calendar availability blocks from operational-calendar ownership into the Resource Runtime. This enforces the boundary that resources (and their availability) are governed by the Resource Catalog and Resource Runtime, not directly by the calendar.

## Scope
1. **Scope === 'resource' Only:** User, site, and study availability blocks remain calendar-owned for now.
2. **Resource Catalog Enforcement:** Resource names provided for resource blocks must strictly match an active resource code from the `ResourceCatalogStore`.
3. **No Implicit Creation:** Resources cannot be implicitly created via a calendar block creation action. If a resource code does not exist, the operation is rejected.
4. **Traceability:** A new `resource_block_id` is added to the calendar's mirror payload as an additive trace field, allowing the calendar read model to link back to the Resource Runtime block.

## Implementation Details
- `lib/resource-runtime/integration/calendar-availability-block.service.ts` encapsulates the creation and cancellation of resource blocks, delegating to `createResourceBlock` and `cancelResourceBlock`.
- `app/(ops)/operational-calendar/actions.ts` intercepts requests with `scope === 'resource'` and redirects them to the new service methods.
- The `calendar_availability_block_created`, `calendar_availability_block_updated`, and `calendar_availability_block_cancelled` events are preserved exactly as before, with the addition of `resource_block_id` in their payload.
- Protocol reschedule logic, calendar read models, and existing chains are unmodified.
- No new architecture is introduced; we use the existing `logOperationalEvent` mechanics to emit calendar mirror events after securing the resource block.
