export type {
  AuditEvent,
  AuditEventAction,
  AuditPolicy,
} from '@/lib/source-engine/definitions/types'

export type SignatureImpact = 'none' | 'broken' | 'locked' | 'applied'
