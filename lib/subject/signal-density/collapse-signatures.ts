import type { PendingSignatureItem } from '@/lib/subject/operations/types'

function groupKey(sig: PendingSignatureItem): string {
  return `${sig.kind}:${sig.label.trim()}`
}

function visitCountLabel(count: number): string {
  return `${count} visit${count === 1 ? '' : 's'}`
}

/** Collapse repeated coordinator / investigator signature rows across visits. */
export function collapsePendingSignatures(items: PendingSignatureItem[]): PendingSignatureItem[] {
  const buckets = new Map<string, PendingSignatureItem[]>()

  for (const sig of items) {
    const key = groupKey(sig)
    const bucket = buckets.get(key) ?? []
    bucket.push(sig)
    buckets.set(key, bucket)
  }

  const collapsed: PendingSignatureItem[] = []

  for (const [key, group] of buckets) {
    if (group.length === 1) {
      collapsed.push(group[0])
      continue
    }

    const lead = group[0]
    collapsed.push({
      id: `sig-group-${key}`,
      kind: lead.kind,
      label: lead.label,
      visitName: visitCountLabel(group.length),
      href: lead.href,
    })
  }

  return collapsed
}
