const VAULT_READ_SCOPE = Symbol('protocol-vault-read-scope')

export type ProtocolVaultReadScope = {
  readonly __vaultReadScope: typeof VAULT_READ_SCOPE
}

/** Create a scope token before reading vault-only raw document fields. */
export function createProtocolVaultReadScope(): ProtocolVaultReadScope {
  return { __vaultReadScope: VAULT_READ_SCOPE }
}

export function assertProtocolVaultReadScope(
  scope: ProtocolVaultReadScope,
  context = 'protocol raw document read',
): void {
  if (scope.__vaultReadScope !== VAULT_READ_SCOPE) {
    throw new Error(`Raw vault read rejected: invalid scope (${context}).`)
  }
}
