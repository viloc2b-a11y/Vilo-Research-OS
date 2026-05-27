export class OperationalSignatureStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OperationalSignatureStateError'
  }
}
