import type { ValidationIssueItem } from '@/lib/subject/operations/types'

function groupKey(issue: ValidationIssueItem): string {
  return `${issue.kind}:${issue.label.trim()}`
}

function visitCountLabel(count: number): string {
  return `${count} visit${count === 1 ? '' : 's'}`
}

/**
 * Collapse identical validation labels (e.g. CBC — incomplete) across visits
 * into one coordinator-scannable row while preserving the primary drilldown href.
 */
export function collapseValidationIssues(items: ValidationIssueItem[]): ValidationIssueItem[] {
  const buckets = new Map<string, ValidationIssueItem[]>()

  for (const issue of items) {
    const key = groupKey(issue)
    const bucket = buckets.get(key) ?? []
    bucket.push(issue)
    buckets.set(key, bucket)
  }

  const collapsed: ValidationIssueItem[] = []

  for (const [key, group] of buckets) {
    if (group.length === 1) {
      collapsed.push(group[0])
      continue
    }

    const lead = group[0]
    collapsed.push({
      id: `group-${key}`,
      kind: lead.kind,
      label: `${lead.label} (${visitCountLabel(group.length)})`,
      visitId: lead.visitId,
      visitName: visitCountLabel(group.length),
      href: lead.href,
    })
  }

  return collapsed
}
