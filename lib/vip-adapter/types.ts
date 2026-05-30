import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ProtocolRuntimeProcedureCandidateRow,
  ProtocolRuntimeSectionRow,
  ProtocolRuntimeStudyRow,
  ProtocolRuntimeVersionRow,
  ProtocolRuntimeVisitCandidateRow,
} from '@/lib/protocol-intake-runtime/protocol-intake-types'

export type VipUseCase = 'protocol_intake.screening_visit_source_draft'

export type VipAvailability = 'available' | 'unavailable'

export type VipContextResolution = {
  availability: VipAvailability
  baseUrl: string | null
  hasApiKey: boolean
  reason?: string
}

export type VipProtocolContext = {
  organizationId: string
  studyId: string
  protocolRuntimeStudy: ProtocolRuntimeStudyRow
  protocolVersion: ProtocolRuntimeVersionRow
  sections: ProtocolRuntimeSectionRow[]
  visitCandidates: ProtocolRuntimeVisitCandidateRow[]
  procedureCandidates: ProtocolRuntimeProcedureCandidateRow[]
}

export type ReadVipContextArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  protocolRuntimeStudyId: string
  protocolVersionId?: string | null
  traceId: string
}

export type VipDraftArtifact = {
  artifact_type: 'screening_visit_source_draft'
  organization_id: string
  study_id: string
  protocol_runtime_study_id: string
  protocol_version_id: string
  trace_id: string
  generated_by: 'vip' | 'vilo_controlled_fallback'
  generated_at: string
  title: string
  source_document: {
    visit_name: string
    sections: {
      title: string
      fields: {
        label: string
        type: 'text' | 'date' | 'checkbox' | 'number'
        required: boolean
        source: string
      }[]
    }[]
  }
  metadata: Record<string, unknown>
}

export type GenerateVipDraftArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  protocolRuntimeStudyId: string
  protocolVersionId?: string | null
  traceId?: string
  useCase?: VipUseCase
}

export type GenerateVipDraftResult = {
  ok: true
  traceId: string
  vip: VipContextResolution
  artifact: VipDraftArtifact
  fallback: boolean
}

export type CaptureVipFeedbackArgs = {
  organizationId: string
  studyId: string
  traceId: string
  artifactId?: string | null
  feedback: {
    disposition: 'accepted' | 'edited' | 'rejected'
    notes?: string | null
    changes?: Record<string, unknown>
  }
}

export type CaptureVipFeedbackResult = {
  ok: boolean
  traceId: string
  capturedBy: 'vip' | 'vilo_log_only'
  reason?: string
}
