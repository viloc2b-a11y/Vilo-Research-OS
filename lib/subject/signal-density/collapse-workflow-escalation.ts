import type { WorkflowEscalationItem } from '@/lib/subject/workflow-escalation/types'

const GROUP_RANK: Record<WorkflowEscalationItem['group'], number> = {
  critical_overdue: 0,
  due_soon: 1,
  pending_signatures: 2,
  other_open: 3,
}

function visitCountLabel(count: number): string {
  return `${count} visit${count === 1 ? '' : 's'}`
}

function groupKey(item: WorkflowEscalationItem): string | null {
  if (item.kind === 'signature') {
    return `signature:${item.title.trim()}`
  }
  if (
    item.kind === 'validation_blocked' ||
    item.kind === 'validation_incomplete' ||
    item.kind === 'validation_finding'
  ) {
    return `${item.kind}:${item.title.trim()}`
  }
  return null
}

export function collapseWorkflowEscalationItems(
  items: WorkflowEscalationItem[],
): WorkflowEscalationItem[] {
  const grouped = new Map<string, WorkflowEscalationItem[]>()
  const passthrough: WorkflowEscalationItem[] = []

  for (const item of items) {
    const key = groupKey(item)
    if (!key) {
      passthrough.push(item)
      continue
    }
    const bucket = grouped.get(key) ?? []
    bucket.push(item)
    grouped.set(key, bucket)
  }

  const collapsed: WorkflowEscalationItem[] = [...passthrough]

  for (const [key, group] of grouped) {
    if (group.length === 1) {
      collapsed.push(group[0])
      continue
    }

    const lead = group[0]
    collapsed.push({
      ...lead,
      id: `group-${key}`,
      visitId: null,
      visitName: visitCountLabel(group.length),
      description: lead.description
        ? `${visitCountLabel(group.length)} · ${lead.description}`
        : visitCountLabel(group.length),
    })
  }

  return collapsed.sort((a, b) => {
    const ga = GROUP_RANK[a.group] ?? 9
    const gb = GROUP_RANK[b.group] ?? 9
    if (ga !== gb) return ga - gb
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}
