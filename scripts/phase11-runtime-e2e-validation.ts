/**
 * Phase 11 — End-to-end runtime validation & pilot hardening.
 *
 * Offline (default): synthetic chain + static integrity — no DB.
 * Live (--live): also validates pilot visit projections, replay, UI model.
 *
 * Run:
 *   npx tsx scripts/phase11-runtime-e2e-validation.ts
 *   npx tsx scripts/phase11-runtime-e2e-validation.ts --live
 *   npx tsx scripts/phase11-runtime-e2e-validation.ts --live --fail-on-fail
 *   npx tsx scripts/phase11-runtime-e2e-validation.ts --live --apply-automation --actor-user-id <uuid>
 *   npx tsx scripts/phase11-runtime-e2e-validation.ts --live --use-default-fixture
 *   npx tsx scripts/phase11-runtime-e2e-validation.ts --write-report .runtime-validation/report.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { printRuntimeE2EReport, runRuntimeE2EValidation } from '../lib/runtime-validation/run-e2e'
import { formatFailureReportMarkdown } from '../lib/runtime-validation/failure-report'
import { resolvePilotFixture } from '../lib/runtime-validation/pilot-fixture'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const live = process.argv.includes('--live')
const failOnFail = process.argv.includes('--fail-on-fail')
const applyAutomation = process.argv.includes('--apply-automation')
const useDefaultFixture = process.argv.includes('--use-default-fixture')
const writeIdx = process.argv.indexOf('--write-report')
const writePath = writeIdx >= 0 ? process.argv[writeIdx + 1] : null
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function argValue(name: string): string | null {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return null
  const value = process.argv[idx + 1]?.trim()
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a non-empty value.`)
  }
  return value
}

function explicitFixtureProvided(): boolean {
  return Boolean(
    process.env.PHASE11_STUDY_ID?.trim()
      && process.env.PHASE11_SUBJECT_ID?.trim()
      && process.env.PHASE11_VISIT_ID?.trim()
      && process.env.PHASE11_ORG_ID?.trim(),
  )
}

async function loadEnv() {
  const { loadEnvFiles } = await import('./lib/env.mjs')
  loadEnvFiles()
}

async function main() {
  await loadEnv()

  let pilot: Awaited<ReturnType<typeof resolvePilotFixture>> = null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const actorUserId = argValue('--actor-user-id')

  if (actorUserId && !UUID_RE.test(actorUserId)) {
    throw new Error('--actor-user-id must be a valid UUID.')
  }

  if (applyAutomation && !actorUserId) {
    throw new Error('--apply-automation requires --actor-user-id <uuid>.')
  }

  if (applyAutomation && !useDefaultFixture && !explicitFixtureProvided()) {
    throw new Error(
      '--apply-automation requires explicit PHASE11_STUDY_ID, PHASE11_SUBJECT_ID, PHASE11_VISIT_ID, and PHASE11_ORG_ID, or deliberate --use-default-fixture.',
    )
  }

  if (live && url && serviceKey) {
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    pilot = await resolvePilotFixture({ supabase, allowDefaultFixture: useDefaultFixture || !applyAutomation })
  }

  const report = await runRuntimeE2EValidation({
    projectRoot: root,
    live,
    supabaseUrl: url,
    supabaseServiceKey: serviceKey,
    applyAutomation,
    actorUserId,
    pilot: pilot
      ? {
          studyId: pilot.studyId,
          studySubjectId: pilot.studySubjectId,
          visitId: pilot.visitId,
          organizationId: pilot.organizationId,
        }
      : {
          studyId: process.env.PHASE11_STUDY_ID,
          studySubjectId: process.env.PHASE11_SUBJECT_ID,
          visitId: process.env.PHASE11_VISIT_ID,
          organizationId: process.env.PHASE11_ORG_ID,
        },
  })

  printRuntimeE2EReport(report)

  const outJson = writePath ?? resolve(root, '.runtime-validation', 'phase11-report.json')
  const outMd = outJson.replace(/\.json$/i, '.md')
  mkdirSync(dirname(outJson), { recursive: true })
  writeFileSync(outJson, JSON.stringify(report, null, 2))
  writeFileSync(outMd, formatFailureReportMarkdown(report))
  console.log(`\nWrote ${outJson}`)
  console.log(`Wrote ${outMd}`)

  if (failOnFail && report.overallStatus === 'fail') {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
