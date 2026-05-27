export const PLACEHOLDER_SCOPE = {
  PACKAGE: 'package',
  VISIT: 'visit',
  PROCEDURE: 'procedure',
  SECTION: 'section',
} as const

export type PlaceholderScope = (typeof PLACEHOLDER_SCOPE)[keyof typeof PLACEHOLDER_SCOPE]

export const SIGNATURE_MEANING = {
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  PERFORMED: 'performed',
  VERIFIED: 'verified',
  CERTIFIED: 'certified',
} as const

export type SignatureMeaning = (typeof SIGNATURE_MEANING)[keyof typeof SIGNATURE_MEANING]

export const PLACEHOLDER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const

export type PlaceholderStatus = (typeof PLACEHOLDER_STATUS)[keyof typeof PLACEHOLDER_STATUS]

export const PUBLICATION_STATUS = {
  PUBLISHED: 'published',
  SUPERSEDED: 'superseded',
  ARCHIVED: 'archived',
} as const

export type PublicationStatus = (typeof PUBLICATION_STATUS)[keyof typeof PUBLICATION_STATUS]

export const PUBLICATION_EVENT_TYPE = {
  SIGNATURE_PLACEHOLDER_CREATED: 'signature_placeholder_created',
  SOURCE_PACKAGE_PUBLISHED: 'source_package_published',
  SOURCE_PACKAGE_SUPERSEDED: 'source_package_superseded',
  SOURCE_PACKAGE_PUBLISH_FAILED: 'source_package_publish_failed',
} as const

export type PublicationEventType =
  (typeof PUBLICATION_EVENT_TYPE)[keyof typeof PUBLICATION_EVENT_TYPE]

export type RuntimeSourceSignaturePlaceholderRow = {
  id: string
  organizationId: string
  studyId: string
  sourcePackageId: string
  visitShellId: string | null
  procedureShellId: string | null
  placeholderScope: PlaceholderScope
  requiredRole: string
  signatureMeaning: SignatureMeaning
  required: boolean
  sequenceOrder: number
  displayLabel: string
  instructions: string | null
  status: PlaceholderStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type RuntimeSourcePackagePublicationRow = {
  id: string
  organizationId: string
  studyId: string
  sourcePackageId: string
  publicationVersion: number
  publicationStatus: PublicationStatus
  packageHash: string
  publishedBy: string
  publishedAt: string
  supersedesPublicationId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type RuntimeSourcePublicationEventRow = {
  id: string
  organizationId: string
  studyId: string
  sourcePackageId: string
  publicationId: string | null
  eventType: PublicationEventType
  actorId: string | null
  eventTimestamp: string
  eventPayload: Record<string, unknown>
  stateHash: string
  metadata: Record<string, unknown>
}

export type PublishRuntimeSourcePackageInput = {
  organization_id: string
  study_id: string
  source_package_id: string
}

export function mapSignaturePlaceholderRow(
  row: Record<string, unknown>,
): RuntimeSourceSignaturePlaceholderRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    sourcePackageId: String(row.source_package_id),
    visitShellId: row.visit_shell_id ? String(row.visit_shell_id) : null,
    procedureShellId: row.procedure_shell_id ? String(row.procedure_shell_id) : null,
    placeholderScope: row.placeholder_scope as PlaceholderScope,
    requiredRole: String(row.required_role),
    signatureMeaning: row.signature_meaning as SignatureMeaning,
    required: Boolean(row.required),
    sequenceOrder: Number(row.sequence_order),
    displayLabel: String(row.display_label),
    instructions: row.instructions ? String(row.instructions) : null,
    status: row.status as PlaceholderStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapPublicationRow(row: Record<string, unknown>): RuntimeSourcePackagePublicationRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    sourcePackageId: String(row.source_package_id),
    publicationVersion: Number(row.publication_version),
    publicationStatus: row.publication_status as PublicationStatus,
    packageHash: String(row.package_hash),
    publishedBy: String(row.published_by),
    publishedAt: String(row.published_at),
    supersedesPublicationId: row.supersedes_publication_id ? String(row.supersedes_publication_id) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }
}

export function mapPublicationEventRow(
  row: Record<string, unknown>,
): RuntimeSourcePublicationEventRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    sourcePackageId: String(row.source_package_id),
    publicationId: row.publication_id ? String(row.publication_id) : null,
    eventType: row.event_type as PublicationEventType,
    actorId: row.actor_id ? String(row.actor_id) : null,
    eventTimestamp: String(row.event_timestamp),
    eventPayload: (row.event_payload ?? {}) as Record<string, unknown>,
    stateHash: String(row.state_hash),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }
}

