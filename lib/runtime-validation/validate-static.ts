import path from 'node:path'
import { catalogSummary } from '@/lib/runtime-integrity/detect/silent-mutation-catalog'
import {
  scanDirectoryForDirectMutations,
  summarizeDirectMutationFindings,
} from '@/lib/runtime-integrity/detect/direct-mutation-scanner'
import type { RuntimeChainCheck } from '@/lib/runtime-validation/types'
import { failure } from '@/lib/runtime-validation/failure-report'

export function runStaticIntegrityValidation(projectRoot: string): {
  checks: RuntimeChainCheck[]
  failures: ReturnType<typeof failure>[]
  summary: { directMutationBlockers: number; directMutationWarnings: number; catalogSilent: number }
} {
  const findings = scanDirectoryForDirectMutations(projectRoot)
  const summary = summarizeDirectMutationFindings(findings)
  const catalog = catalogSummary()

  const checks: RuntimeChainCheck[] = [
    {
      id: 'no-silent-mutation',
      goal: 10,
      label: 'No silent mutation breaks the chain (static audit)',
      status: summary.blockers === 0 ? 'pass' : 'warn',
      detail:
        summary.blockers === 0
          ? `No unapproved direct-mutation blockers in lib/ (${summary.total} findings, ${summary.warnings} warnings).`
          : `${summary.blockers} static blocker path(s) — review integrity audit before pilot.`,
      evidence: { blockers: summary.blockers, warnings: summary.warnings },
    },
  ]

  const failures = []
  if (summary.blockers > 0) {
    failures.push(
      failure(
        'no-silent-mutation',
        'warning',
        `${summary.blockers} direct clinical mutation path(s) without spine emission hint.`,
        'Run npm run integrity:audit and route mutations through clinical-mutation-gateway or approved RPCs.',
      ),
    )
  }

  return {
    checks,
    failures,
    summary: {
      directMutationBlockers: summary.blockers,
      directMutationWarnings: summary.warnings,
      catalogSilent: (catalog.silent as number) ?? 0,
    },
  }
}

export function defaultProjectRoot(): string {
  return path.resolve(import.meta.dirname, '../..')
}
