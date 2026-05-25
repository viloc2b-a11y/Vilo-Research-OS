export type AdminUserActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_ADMIN_USER_ACTION_STATE: AdminUserActionState = {
  ok: false,
  message: null,
}
