export const OBLIGATION_TYPE = {
  SIGNATURE: 'signature',
  ACKNOWLEDGEMENT: 'acknowledgement',
} as const

export type ObligationType = (typeof OBLIGATION_TYPE)[keyof typeof OBLIGATION_TYPE]

export const OBLIGATION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ESCALATED: 'escalated',
  OVERDUE: 'overdue',
} as const

export type ObligationStatus = (typeof OBLIGATION_STATUS)[keyof typeof OBLIGATION_STATUS]

export const ACKNOWLEDGEMENT_TYPE = {
  PASSIVE: 'passive',
  OPERATIONAL: 'operational',
  TRAINING: 'training',
  AMENDMENT: 'amendment',
} as const

export type AcknowledgementType = (typeof ACKNOWLEDGEMENT_TYPE)[keyof typeof ACKNOWLEDGEMENT_TYPE]

export const SIGNATURE_MEANING = {
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  PERFORMED: 'performed',
  CERTIFIED: 'certified',
  DELEGATED: 'delegated',
  ACKNOWLEDGED: 'acknowledged',
} as const

export type SignatureMeaning = (typeof SIGNATURE_MEANING)[keyof typeof SIGNATURE_MEANING]

export const SIGNATURE_MEANING_LABELS: Record<SignatureMeaning, string> = {
  reviewed: 'Reviewed',
  approved: 'Approved',
  performed: 'Performed',
  certified: 'Certified',
  delegated: 'Delegated',
  acknowledged: 'Acknowledged',
}

export const ACKNOWLEDGEMENT_TYPE_LABELS: Record<AcknowledgementType, string> = {
  passive: 'Read confirmation',
  operational: 'Operational change understood',
  training: 'Training completed',
  amendment: 'Protocol amendment acknowledged',
}

export const ASSIGNED_ROLE_OPTIONS = [
  { value: 'research_coordinator', label: 'Research coordinator' },
  { value: 'data_coordinator', label: 'Data coordinator' },
  { value: 'pi_sub_i', label: 'PI / Sub-I' },
  { value: 'site_staff', label: 'Site staff' },
  { value: 'unblinded_coordinator', label: 'Unblinded coordinator' },
] as const

export type CreateObligationInput = {
  obligation_type: ObligationType
  acknowledgement_type?: AcknowledgementType | null
  signature_meaning?: SignatureMeaning | null
  assigned_role?: string | null
  assigned_user_id?: string | null
  due_date?: string | null
  reminder_policy?: Record<string, unknown>
  escalation_policy?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type ComplianceObligationRow = {
  id: string
  organizationId: string
  documentId: string
  obligationType: ObligationType
  acknowledgementType: AcknowledgementType | null
  signatureMeaning: SignatureMeaning | null
  assignedRole: string | null
  assignedUserId: string | null
  requestedBy: string
  requestedAt: string
  dueDate: string | null
  status: ObligationStatus
  completedBy: string | null
  completedAt: string | null
  completionMeaning: string | null
  reminderPolicy: Record<string, unknown>
  escalationPolicy: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type PendingObligationView = ComplianceObligationRow & {
  documentOperationalDisplayName: string
  documentClassification: string
  documentOriginalFilename: string
}
