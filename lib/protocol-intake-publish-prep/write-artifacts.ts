import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  publishCandidateApprovalPath,
  publishCandidateAuditPath,
  publishCandidateDir,
  publishCandidatePath,
} from '@/lib/protocol-intake-publish-prep/paths'
import type {
  PublishCandidate,
  PublishCandidateApproval,
  PublishCandidateAuditEvent,
} from '@/lib/protocol-intake-publish-prep/types'

export function loadPublishCandidate(
  draftKey: string,
  cwd = process.cwd(),
): PublishCandidate | null {
  const path = publishCandidatePath(draftKey, cwd)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PublishCandidate
  } catch {
    return null
  }
}

export function appendPublishCandidateAuditEvent(
  draftKey: string,
  auditEvent: PublishCandidateAuditEvent,
  cwd = process.cwd(),
): void {
  mkdirSync(publishCandidateDir(draftKey, cwd), { recursive: true })
  const auditPath = publishCandidateAuditPath(draftKey, cwd)
  let events: PublishCandidateAuditEvent[] = []
  if (existsSync(auditPath)) {
    try {
      const parsed = JSON.parse(readFileSync(auditPath, 'utf8'))
      events = Array.isArray(parsed) ? (parsed as PublishCandidateAuditEvent[]) : []
    } catch {
      events = []
    }
  }
  events.push(auditEvent)
  writeFileSync(auditPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8')
}

export function writePublishCandidateArtifacts(
  candidate: PublishCandidate,
  auditEvent: PublishCandidateAuditEvent,
  cwd = process.cwd(),
): void {
  mkdirSync(publishCandidateDir(candidate.draft_key, cwd), { recursive: true })
  writeFileSync(
    publishCandidatePath(candidate.draft_key, cwd),
    `${JSON.stringify(candidate, null, 2)}\n`,
    'utf8',
  )
  appendPublishCandidateAuditEvent(candidate.draft_key, auditEvent, cwd)
}

export function writePublishCandidateApproval(
  approval: PublishCandidateApproval,
  auditEvent: PublishCandidateAuditEvent,
  cwd = process.cwd(),
): void {
  mkdirSync(publishCandidateDir(approval.draft_key, cwd), { recursive: true })
  writeFileSync(
    publishCandidateApprovalPath(approval.draft_key, cwd),
    `${JSON.stringify(approval, null, 2)}\n`,
    'utf8',
  )
  appendPublishCandidateAuditEvent(approval.draft_key, auditEvent, cwd)
}
