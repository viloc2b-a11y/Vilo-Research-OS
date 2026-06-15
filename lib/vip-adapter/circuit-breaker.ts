type CircuitState = 'closed' | 'open' | 'half_open'

type CircuitBreakerConfig = {
  failureThreshold: number
  recoveryWindowMs: number
  halfOpenProbeLimit: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  recoveryWindowMs: 60_000,
  halfOpenProbeLimit: 1,
}

type BreakerRecord = {
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  halfOpenProbes: number
}

const breakers = new Map<string, BreakerRecord>()

function getOrCreate(key: string): BreakerRecord {
  if (!breakers.has(key)) {
    breakers.set(key, { state: 'closed', failureCount: 0, lastFailureAt: null, halfOpenProbes: 0 })
  }
  return breakers.get(key)!
}

export function circuitAllows(key: string, config = DEFAULT_CONFIG): boolean {
  const record = getOrCreate(key)
  const now = Date.now()

  if (record.state === 'closed') return true

  if (record.state === 'open') {
    const elapsed = now - (record.lastFailureAt ?? 0)
    if (elapsed >= config.recoveryWindowMs) {
      record.state = 'half_open'
      record.halfOpenProbes = 0
    } else {
      return false
    }
  }

  if (record.state === 'half_open') {
    if (record.halfOpenProbes < config.halfOpenProbeLimit) {
      record.halfOpenProbes++
      return true
    }
    return false
  }

  return true
}

export function circuitSuccess(key: string): void {
  const record = getOrCreate(key)
  record.state = 'closed'
  record.failureCount = 0
  record.lastFailureAt = null
  record.halfOpenProbes = 0
}

export function circuitFailure(key: string, config = DEFAULT_CONFIG): void {
  const record = getOrCreate(key)
  record.failureCount++
  record.lastFailureAt = Date.now()

  if (record.state === 'half_open' || record.failureCount >= config.failureThreshold) {
    record.state = 'open'
    record.halfOpenProbes = 0
  }
}

export function circuitState(key: string): CircuitState {
  return getOrCreate(key).state
}

export function circuitReset(key: string): void {
  breakers.delete(key)
}
