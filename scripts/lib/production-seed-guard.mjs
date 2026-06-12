export function assertProductionSeedAllowed(scriptName) {
  if (process.env.ALLOW_PRODUCTION_SEED === 'true') return

  throw new Error(
    `${scriptName} writes generated smoke/staging data. Refusing to run unless ALLOW_PRODUCTION_SEED=true. ` +
      'Use dry-run/read-only validation when possible, or run against an isolated staging database.',
  )
}

export function testRecordMetadata(seedSource) {
  return {
    is_test_data: true,
    created_by_system: true,
    seed_source: seedSource,
    provenance: seedSource,
  }
}
