import type { RuntimeE2EReport, RuntimeValidationFailure } from '@/lib/runtime-validation/types'

export function formatFailureReportMarkdown(report: RuntimeE2EReport): string {
  const lines: string[] = [
    `# Phase 11 Runtime E2E — ${report.overallStatus.toUpperCase()}`,
    ``,
    `Run: ${report.runAt}`,
    `Mode: ${report.mode}`,
    ``,
    `## Pilot scope`,
    `- Study: ${report.pilot.studyId ?? 'n/a'}`,
    `- Subject: ${report.pilot.studySubjectId ?? 'n/a'}`,
    `- Visit: ${report.pilot.visitId ?? 'n/a'}`,
    ``,
    `## Chain checks`,
  ]

  for (const c of report.chainChecks) {
    lines.push(`- [${c.status.toUpperCase()}] **${c.label}** — ${c.detail}`)
  }

  if (report.failures.length > 0) {
    lines.push(``, `## Failures`)
    for (const f of report.failures) {
      lines.push(`- **${f.severity}** \`${f.checkId}\`: ${f.message}`)
      if (f.remediation) lines.push(`  - Fix: ${f.remediation}`)
    }
  }

  if (report.remainingBlockers.length > 0) {
    lines.push(``, `## Remaining blockers`)
    for (const b of report.remainingBlockers) {
      lines.push(`- ${b}`)
    }
  }

  if (report.recommendedFixes.length > 0) {
    lines.push(``, `## Recommended fixes before real pilot`)
    for (const r of report.recommendedFixes) {
      lines.push(`- ${r}`)
    }
  }

  return lines.join('\n')
}

export function deriveOverallStatus(checks: RuntimeE2EReport['chainChecks']): RuntimeE2EReport['overallStatus'] {
  if (checks.some((c) => c.status === 'fail')) return 'fail'
  if (checks.some((c) => c.status === 'warn')) return 'degraded'
  return 'pass'
}

export function failure(
  checkId: string,
  severity: RuntimeValidationFailure['severity'],
  message: string,
  remediation?: string,
): RuntimeValidationFailure {
  return { checkId, severity, message, remediation }
}
