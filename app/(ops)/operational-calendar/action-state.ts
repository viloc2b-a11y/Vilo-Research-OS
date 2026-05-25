export type CreateManualCalendarEventState = {
  ok: boolean
  message: string | null
}

export type ManualCalendarEventMutationState = CreateManualCalendarEventState
export type AvailabilityBlockMutationState = CreateManualCalendarEventState
export type ProtocolVisitRescheduleMutationState = CreateManualCalendarEventState
