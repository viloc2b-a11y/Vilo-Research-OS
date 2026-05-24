/**
 * Phase 16A-2.7 — Service role usage audit (report only; fail on unjustified coordinator paths).
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, '.runtime-validation')
const OUT_FILE = join(OUT_DIR, 'service-role-audit.md')

const PATTERNS = [
  /service_role/gi,
  /serviceRole/g,
  /SUPABASE_SERVICE_ROLE_KEY/g,
  /createServiceClient/g,
]

type Finding = {
  file: string
  usage: string
  likelyPurpose: string
  coordinatorFacingRisk: 'low' | 'medium' | 'high'
  recommendation: string
}

function classify(file: string): Pick<Finding, 'likelyPurpose' | 'coordinatorFacingRisk' | 'recommendation'> {
  const normalized = file.replace(/\\/g, '/')

  if (normalized.includes('/scripts/') || normalized.endsWith('.mjs')) {
    return {
      likelyPurpose: 'Ops/seed/E2E script (non-coordinator runtime)',
      coordinatorFacingRisk: 'low',
      recommendation: 'Acceptable for staging automation; keep out of request path.',
    }
  }

  if (normalized.includes('lib/admin/')) {
    return {
      likelyPurpose: 'Org admin user management',
      coordinatorFacingRisk: 'low',
      recommendation: 'Admin-only; document service-role requirement.',
    }
  }

  if (normalized.includes('lib/subject/visit-documents/')) {
    return {
      likelyPurpose: 'Storage upload/download for visit documents',
      coordinatorFacingRisk: 'medium',
      recommendation:
        'Review RLS vs storage policies; avoid expanding service-role scope into source capture.',
    }
  }

  if (
    normalized.includes('app/api/') ||
    normalized.includes('lib/visit-runtime/') ||
    normalized.includes('lib/source/')
  ) {
    return {
      likelyPurpose: 'Potential coordinator-facing runtime path',
      coordinatorFacingRisk: 'high',
      recommendation: 'BLOCKER: remove service role from coordinator runtime; use user-scoped client + RLS.',
    }
  }

  return {
    likelyPurpose: 'Supporting library or infrastructure',
    coordinatorFacingRisk: 'low',
    recommendation: 'No action unless used from coordinator APIs.',
  }
}

function scanFile(file: string): Finding[] {
  const content = readFileSync(file, 'utf8')
  const findings: Finding[] = []
  for (const pattern of PATTERNS) {
    if (!pattern.test(content)) continue
    const match = content.match(pattern)
    const classification = classify(file)
    findings.push({
      file,
      usage: match?.[0] ?? pattern.source,
      ...classification,
    })
    break
  }
  return findings
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, acc)
      continue
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry)) acc.push(full)
  }
  return acc
}

function main() {
  const files = walk(ROOT)
  const allFindings = files.flatMap((file) => scanFile(file))
  const blockers = allFindings.filter((f) => f.coordinatorFacingRisk === 'high')

  mkdirSync(OUT_DIR, { recursive: true })

  const lines: string[] = [
    '# Service role audit (Phase 16A-2.7)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total findings: ${allFindings.length}`,
    `Coordinator-facing high risk: ${blockers.length}`,
    '',
    '| File | Usage | Purpose | Risk | Recommendation |',
    '| --- | --- | --- | --- | --- |',
  ]

  for (const f of allFindings) {
    lines.push(
      `| \`${f.file.replace(ROOT, '').replace(/^\\/, '')}\` | ${f.usage} | ${f.likelyPurpose} | ${f.coordinatorFacingRisk} | ${f.recommendation} |`,
    )
  }

  if (blockers.length > 0) {
    lines.push('', '## Blockers', '')
    for (const b of blockers) {
      lines.push(`- ${b.file}`)
    }
  } else {
    lines.push('', '## Result', '', 'No coordinator-facing runtime/source paths use service role without justification.')
  }

  writeFileSync(OUT_FILE, lines.join('\n'), 'utf8')
  console.log(`Wrote ${OUT_FILE}`)

  if (blockers.length > 0) {
    console.error('service-role-audit: FAIL (coordinator-facing service role usage)')
    process.exit(1)
  }

  console.log('phase16a27-service-role-audit: PASS')
}

main()
