/**
 * Discover or validate pilot fixture IDs for Phase 11 live E2E.
 *
 * Run:
 *   npx tsx scripts/phase11-runtime-pilot-fixture.ts
 *
 * Env:
 *   PHASE11_STUDY_ID (or PHASE9_STUDY_ID)
 *   PHASE11_SUBJECT_ID, PHASE11_VISIT_ID (optional — auto-discover)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { PILOT_FIXTURE_DEFAULTS } from '../lib/runtime-validation/pilot-fixture-defaults'
import { pilotFixtureEnvHints, resolvePilotFixture } from '../lib/runtime-validation/pilot-fixture'
import { verifyPilotCoordinatorCaptureAccess } from '../lib/runtime-validation/verify-pilot-coordinator-capture-access'
import { verifyPilotProcedureLinkage } from '../lib/runtime-validation/verify-pilot-procedure-linkage'
import { verifyPilotProcedureSourceBinding } from '../lib/runtime-validation/verify-pilot-source-binding'
import { PILOT_SCENARIO_STEPS } from '../lib/runtime-validation/checklist'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const { loadEnvFiles, requireEnv } = await import('./lib/env.mjs')
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const envHints = pilotFixtureEnvHints()
  const fixture = await resolvePilotFixture({ supabase })
  if (!fixture) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: 'Could not resolve pilot fixture. Set PHASE11_STUDY_ID and ensure subject/visit exist.',
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const sourceBinding = await verifyPilotProcedureSourceBinding({
    supabase,
    organizationId: fixture.organizationId,
    studyId: fixture.studyId,
  })

  const coordinatorCaptureAccess = await verifyPilotCoordinatorCaptureAccess({
    supabase,
    organizationId: fixture.organizationId,
    studyId: fixture.studyId,
    coordinatorUserId: process.env.PHASE11_COORDINATOR_ACTOR_ID?.trim() ?? PILOT_FIXTURE_DEFAULTS.coordinatorActorUserId,
  })

  const procedureLinkage = await verifyPilotProcedureLinkage({
    supabase,
    organizationId: fixture.organizationId,
    studyId: fixture.studyId,
    visitId: fixture.visitId,
    studySubjectId: fixture.studySubjectId,
  })

  const envSnippet = `# Phase 11/14 pilot fixture — ${fixture.discoveredAt}
PHASE11_STUDY_ID=${fixture.studyId}
PHASE11_SUBJECT_ID=${fixture.studySubjectId}
PHASE11_VISIT_ID=${fixture.visitId}
PHASE11_ORG_ID=${fixture.organizationId}
PHASE11_COORDINATOR_ACTOR_ID=${process.env.PHASE11_COORDINATOR_ACTOR_ID?.trim() ?? PILOT_FIXTURE_DEFAULTS.coordinatorActorUserId}
`

  const payload = {
    ok: true,
    fixture,
    envHints,
    sourceBinding,
    procedureLinkage,
    coordinatorCaptureAccess,
    pilotScenarioSteps: PILOT_SCENARIO_STEPS,
    envSnippet,
    nextCommands: [
      'npm run runtime:pilot-staging-prep',
      'npx tsx scripts/phase11-runtime-e2e-validation.ts --live --fail-on-fail',
      'npm run integrity:audit',
    ],
  }

  const outDir = resolve(root, '.runtime-validation')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'pilot-fixture.json'), JSON.stringify(payload, null, 2))
  writeFileSync(resolve(outDir, 'pilot-fixture.env'), envSnippet)

  console.log(JSON.stringify(payload, null, 2))
  console.log(`\nWrote .runtime-validation/pilot-fixture.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
