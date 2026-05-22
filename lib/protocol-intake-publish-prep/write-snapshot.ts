import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type {
  SourcePackageSnapshot,
  SourcePackageSnapshotAuditEvent,
} from '@/lib/protocol-intake-publish-prep/types'
import {
  sourcePackageSnapshotAuditPath,
  sourcePackageSnapshotPath,
  sourcePublishSnapshotDir,
} from '@/lib/protocol-intake-publish-prep/paths'

export function loadSourcePackageSnapshot(
  draftKey: string,
  cwd = process.cwd(),
): SourcePackageSnapshot | null {
  const path = sourcePackageSnapshotPath(draftKey, cwd)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SourcePackageSnapshot
  } catch {
    return null
  }
}

export function writeSourcePackageSnapshot(
  snapshot: SourcePackageSnapshot,
  auditEvent: SourcePackageSnapshotAuditEvent,
  cwd = process.cwd(),
): void {
  mkdirSync(sourcePublishSnapshotDir(snapshot.draft_key, cwd), { recursive: true })
  writeFileSync(
    sourcePackageSnapshotPath(snapshot.draft_key, cwd),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  )

  const auditPath = sourcePackageSnapshotAuditPath(snapshot.draft_key, cwd)
  let events: SourcePackageSnapshotAuditEvent[] = []
  if (existsSync(auditPath)) {
    try {
      const parsed = JSON.parse(readFileSync(auditPath, 'utf8'))
      events = Array.isArray(parsed) ? (parsed as SourcePackageSnapshotAuditEvent[]) : []
    } catch {
      events = []
    }
  }
  events.push(auditEvent)
  writeFileSync(auditPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8')
}
