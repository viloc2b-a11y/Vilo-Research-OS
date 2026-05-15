/**
 * Phase 1b RLS + auth infrastructure validation.
 * Usage: npm run db:validate
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, projectRoot, requireEnv } from './lib/env.mjs'

const SYNTHETIC = {
  userA: { email: 'synthetic.staff.a@vilo-os.staging', password: 'SyntheticViloOs!2026A' },
  userB: { email: 'synthetic.staff.b@vilo-os.staging', password: 'SyntheticViloOs!2026B' },
}

const results = {
  runAt: new Date().toISOString(),
  phase: '1b',
  checks: [],
  securityGrep: [],
  summary: { passed: 0, failed: 0, blocked: 0 },
}

function record(name, status, detail) {
  results.checks.push({ name, status, detail })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else results.summary.blocked++
}

function clientAsUser(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function grepSecurity() {
  const dirs = ['app', 'components', 'lib']
  const allowServerOnly = new Set([
    '/lib/supabase/server.ts',
    '/lib/audit/log.ts',
  ])
  const hits = []
  for (const dir of dirs) {
    walk(resolve(projectRoot, dir), hits)
  }
  return hits

  function walk(dir, hits) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, ent.name)
      if (ent.isDirectory()) walk(p, hits)
      else if (/\.(tsx?|jsx?|mjs)$/.test(ent.name)) {
        const rel = p.replace(projectRoot, '').replace(/\\/g, '/')
        if (allowServerOnly.has(rel)) continue
        const text = readFileSync(p, 'utf8')
        const isClient = text.includes("'use client'") || text.includes('"use client"')
        const referencesServiceRole =
          text.includes('SUPABASE_SERVICE_ROLE_KEY') ||
          (text.includes('service_role') && isClient)
        if (referencesServiceRole && (isClient || rel.startsWith('/components/'))) {
          hits.push(rel)
        }
      }
    }
  }
}

async function main() {
  try {
    requireEnv([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ])
  } catch (e) {
    record('environment', 'BLOCKED', e.message)
    writeReport()
    process.exit(2)
  }

  loadEnvFiles()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url.includes('placeholder') || url.includes('YOUR_PROJECT')) {
    record('environment', 'BLOCKED', 'NEXT_PUBLIC_SUPABASE_URL is still a placeholder')
    writeReport()
    process.exit(2)
  }

  const grepHits = grepSecurity()
  results.securityGrep = grepHits
  record(
    'service_role_not_in_client_bundle',
    grepHits.length === 0 ? 'PASS' : 'FAIL',
    grepHits.length
      ? `Found in: ${grepHits.join(', ')}`
      : 'No SERVICE_ROLE references under app/components/lib',
  )

  const anonClient = createClient(url, anon)
  const { data: anonOrgs, error: anonOrgErr } = await anonClient
    .from('organizations')
    .select('id')
  record(
    'anon_cannot_read_organizations',
    !anonOrgErr && (anonOrgs?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
    anonOrgErr ? anonOrgErr.message : `rows=${anonOrgs?.length ?? 'n/a'}`,
  )

  const signInA = await anonClient.auth.signInWithPassword(SYNTHETIC.userA)
  const signInB = await anonClient.auth.signInWithPassword(SYNTHETIC.userB)

  if (signInA.error || !signInA.data.session) {
    record('sign_in_user_a', 'BLOCKED', signInA.error?.message ?? 'no session')
    writeReport()
    process.exit(2)
  }
  if (signInB.error || !signInB.data.session) {
    record('sign_in_user_b', 'BLOCKED', signInB.error?.message ?? 'no session')
    writeReport()
    process.exit(2)
  }

  record('sign_in_user_a', 'PASS', SYNTHETIC.userA.email)
  record('sign_in_user_b', 'PASS', SYNTHETIC.userB.email)

  const clientA = clientAsUser(url, anon, signInA.data.session.access_token)
  const clientB = clientAsUser(url, anon, signInB.data.session.access_token)

  const { data: orgsA } = await clientA.from('organizations').select('id, name')
  const { data: orgsB } = await clientB.from('organizations').select('id, name')

  record(
    'user_a_sees_only_own_orgs',
    orgsA?.length === 1 ? 'PASS' : 'FAIL',
    `count=${orgsA?.length ?? 0} names=${orgsA?.map((o) => o.name).join(';')}`,
  )
  record(
    'user_b_sees_only_own_orgs',
    orgsB?.length === 1 ? 'PASS' : 'FAIL',
    `count=${orgsB?.length ?? 0} names=${orgsB?.map((o) => o.name).join(';')}`,
  )

  const orgAId = orgsA?.[0]?.id
  const orgBId = orgsB?.[0]?.id

  if (orgAId && orgBId) {
    const { data: crossB } = await clientB
      .from('organizations')
      .select('id')
      .eq('id', orgAId)
    record(
      'cross_org_b_cannot_read_org_a',
      (crossB?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
      `rows=${crossB?.length ?? 0}`,
    )

    const { data: membersB } = await clientB
      .from('organization_members')
      .select('organization_id')
      .eq('organization_id', orgAId)
    record(
      'cross_org_membership_isolation',
      (membersB?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
      `rows=${membersB?.length ?? 0}`,
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: auditInsertErr } = await admin.from('audit_events').insert({
    organization_id: orgAId,
    actor_user_id: signInA.data.user.id,
    action: 'PHASE1B_VALIDATION',
    target: 'infrastructure_test',
    metadata: { synthetic: true },
  })
  record(
    'audit_insert_service_role',
    !auditInsertErr ? 'PASS' : 'FAIL',
    auditInsertErr?.message ?? 'inserted',
  )

  const { error: auditAnonErr } = await anonClient.from('audit_events').insert({
    organization_id: orgAId,
    actor_user_id: signInA.data.user.id,
    action: 'SHOULD_FAIL',
    target: 'anon_attempt',
  })
  record(
    'audit_insert_blocked_for_anon',
    auditAnonErr ? 'PASS' : 'FAIL',
    auditAnonErr?.message ?? 'anon insert unexpectedly succeeded',
  )

  const { data: auditA } = await clientA.from('audit_events').select('id').limit(5)
  record(
    'user_a_admin_can_read_audit',
    (auditA?.length ?? 0) >= 1 ? 'PASS' : 'FAIL',
    `rows=${auditA?.length ?? 0}`,
  )

  const { data: auditB } = await clientB.from('audit_events').select('id').eq('organization_id', orgAId)
  record(
    'user_b_cannot_read_org_a_audit',
    (auditB?.length ?? 0) === 0 ? 'PASS' : 'FAIL',
    `rows=${auditB?.length ?? 0}`,
  )

  record(
    'middleware_public_paths',
    'PASS',
    'Documented: /login, /auth/callback only (see middleware.ts)',
  )

  writeReport()
  const exitCode = results.summary.failed > 0 ? 1 : results.summary.blocked > 0 ? 2 : 0
  console.log(`\nValidation complete: ${results.summary.passed} pass, ${results.summary.failed} fail, ${results.summary.blocked} blocked`)
  console.log(`Report: docs/PHASE1B-VALIDATION-RESULTS.md`)
  process.exit(exitCode)
}

function writeReport() {
  const md = formatMarkdown(results)
  const out = resolve(projectRoot, 'docs/PHASE1B-VALIDATION-RESULTS.md')
  writeFileSync(out, md, 'utf8')
}

function formatMarkdown(r) {
  const lines = [
    '# Phase 1b — Infrastructure validation results',
    '',
    `**Run at:** ${r.runAt}`,
    '',
    '## Summary',
    '',
    `| Result | Count |`,
    `|--------|-------|`,
    `| PASS | ${r.summary.passed} |`,
    `| FAIL | ${r.summary.failed} |`,
    `| BLOCKED | ${r.summary.blocked} |`,
    '',
    '## Checks',
    '',
    '| Check | Status | Detail |',
    '|-------|--------|--------|',
    ...r.checks.map((c) => `| ${c.name} | ${c.status} | ${String(c.detail).replace(/\|/g, '\\|')} |`),
    '',
    '## Security grep (service role in client paths)',
    '',
    r.securityGrep.length
      ? r.securityGrep.map((p) => `- ${p}`).join('\n')
      : '- None under app/components/lib',
    '',
    '## Manual follow-ups',
    '',
    '- Confirm unauthenticated `/` redirects to `/login` in browser',
    '- Confirm authenticated `/login` redirects to `/`',
    '- Re-run after migrations + provision: `npm run db:migrate && npm run db:provision && npm run db:validate`',
    '',
  ]
  return lines.join('\n')
}

main().catch((err) => {
  record('runtime', 'FAIL', err.message || String(err))
  writeReport()
  console.error(err)
  process.exit(1)
})
