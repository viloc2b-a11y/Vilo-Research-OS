import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ProtocolIntakeDraft } from '@/lib/protocol-intake/types'
import type {
  IntakePackageManifest,
  IntakeReviewPackage,
  IntakeReviewSummary,
  ReviewableItem,
  ReviewerStatus,
} from '@/lib/protocol-intake-review/types'
import {
  canLoadIntakeReviewFixtures,
  intakeReviewRoots,
  workspaceDir,
} from '@/lib/protocol-intake-review/paths'
import { draftToReviewPackage } from '@/lib/protocol-intake-review/normalize-from-ts'
import { pyPackageToReviewPackage } from '@/lib/protocol-intake-review/normalize-from-py'

export type IntakePackageListing = {
  draft_key: string
  label: string
  package_path: string
  study_key: string
  has_approved: boolean
  artifact_files: string[]
}

const ARTIFACT_FILES = [
  'manifest.json',
  'study_metadata_draft.json',
  'eligibility_draft.json',
  'schedule_draft.json',
  'procedure_draft.json',
  'source_composition_draft.json',
  'vpi_draft.json',
  'cliniq_draft.json',
  'review_summary.md',
] as const

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function isPackageDir(dir: string): boolean {
  return existsSync(join(dir, 'manifest.json'))
}

export function discoverIntakePackages(cwd?: string): IntakePackageListing[] {
  if (!canLoadIntakeReviewFixtures()) return []

  const listings: IntakePackageListing[] = []
  const seen = new Set<string>()

  for (const root of intakeReviewRoots(cwd)) {
    if (!existsSync(root)) continue
    if (isPackageDir(root)) {
      addListing(listings, seen, root, root)
      continue
    }
    for (const name of readdirSync(root)) {
      const dir = join(root, name)
      try {
        if (!statSync(dir).isDirectory() || !isPackageDir(dir)) continue
        addListing(listings, seen, dir, name)
      } catch {
        /* skip */
      }
    }
  }

  return listings.sort((a, b) => a.draft_key.localeCompare(b.draft_key))
}

function addListing(
  listings: IntakePackageListing[],
  seen: Set<string>,
  packagePath: string,
  draftKey: string,
) {
  const key = draftKey.replace(/[^a-zA-Z0-9_-]/g, '_')
  if (seen.has(key)) return
  seen.add(key)
  const manifest = readJson(join(packagePath, 'manifest.json')) as IntakePackageManifest
  const approvedPath = join(packagePath, 'approved_intake_draft.json')
  const dataApproved = join(workspaceDir(key), 'approved_intake_draft.json')
  listings.push({
    draft_key: key,
    label: manifest.study_key ?? manifest.protocol_id ?? key,
    package_path: packagePath,
    study_key: manifest.study_key ?? manifest.protocol_id ?? key,
    has_approved: existsSync(approvedPath) || existsSync(dataApproved),
    artifact_files: ARTIFACT_FILES.filter((f) => existsSync(join(packagePath, f))),
  })
}

export function loadIntakePackage(draftKey: string, cwd?: string): IntakeReviewPackage | null {
  if (!canLoadIntakeReviewFixtures()) return null

  const listing = discoverIntakePackages(cwd).find((l) => l.draft_key === draftKey)
  if (!listing) return null

  const base = listing.package_path
  const manifest = readJson(join(base, 'manifest.json')) as IntakePackageManifest

  if (existsSync(join(base, 'study_metadata_draft.json'))) {
    return pyPackageToReviewPackage(draftKey, listing.label, base, manifest)
  }

  const tsDraftPath = join(base, 'intake_draft.json')
  if (existsSync(tsDraftPath)) {
    const draft = readJson(tsDraftPath) as ProtocolIntakeDraft
    return draftToReviewPackage(draftKey, listing.label, base, draft)
  }

  return null
}

export function defaultItemStatus(
  confidence?: string,
  requiresReview?: boolean,
  hasConflict?: boolean,
): ReviewerStatus {
  if (hasConflict) return 'needs_clarification'
  if (requiresReview || confidence === 'low') return 'needs_clarification'
  if (confidence === 'high') return 'pending'
  return 'needs_clarification'
}

export function buildInitialSummary(items: ReviewableItem[], manifest: IntakePackageManifest): IntakeReviewSummary {
  if (manifest.review) return manifest.review
  return {
    found: items.filter((i) => i.section !== 'missing').map((i) => i.title),
    needs_review: items
      .filter((i) => i.fields.some((f) => f.requires_human_review))
      .map((i) => i.title),
    missing: [],
    conflicts: [],
    recommended_source_sections: items
      .filter((i) => i.section === 'source_composition')
      .map((i) => i.title),
  }
}
