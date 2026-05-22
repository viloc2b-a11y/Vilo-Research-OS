export const STALE_WRITE_USER_MESSAGE =
  'Data changed on the server since this form was loaded. Refresh the page and try again.'

export function isStaleWriteError(message: string): boolean {
  return /STALE_WRITE|SET_NOT_MUTABLE|VISIT_LOCKED|SUBMITTED_VALUE_IMMUTABLE/i.test(message)
}
