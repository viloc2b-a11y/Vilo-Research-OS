import { DeliverableDefinition } from './types'

export const DELIVERABLE_DEFINITIONS: Record<string, Omit<DeliverableDefinition, 'id' | 'organizationId'>> = {
  printable_source_packet: {
    systemCode: 'printable_source_packet',
    name: 'Printable Source Packet PDF',
    targetAudience: ['coordinator', 'cra', 'inspection'],
    allowedFormats: ['pdf'],
    scopeModel: 'visit',
    evidenceRules: {
      includedTypes: ['clinical_fields', 'signatures', 'audit_trail'],
      excludedTypes: ['internal_risk', 'finance'],
      versionLogic: 'VERSION_USED_DURING_EXECUTION',
    },
  },
  cra_monitoring_workbook: {
    systemCode: 'cra_monitoring_workbook',
    name: 'CRA Monitoring Workbook',
    targetAudience: ['cra', 'sponsor'],
    allowedFormats: ['xlsx'],
    scopeModel: 'study',
    evidenceRules: {
      includedTypes: ['clinical_fields'], // With specific visit/consent/sig status logic
      excludedTypes: ['internal_intel'],
      versionLogic: 'ALL_EXECUTED_VERSIONS',
    },
  },
  source_evidence_workbook: {
    systemCode: 'source_evidence_workbook',
    name: 'Source Evidence Workbook',
    targetAudience: ['cra', 'investigator', 'qa'],
    allowedFormats: ['xlsx', 'csv'],
    scopeModel: 'subject', // Also study
    evidenceRules: {
      includedTypes: ['clinical_fields'],
      excludedTypes: ['internal_notes'],
      versionLogic: 'ALL_EXECUTED_VERSIONS',
    },
  },
  consent_evidence_package: {
    systemCode: 'consent_evidence_package',
    name: 'Consent Evidence Package',
    targetAudience: ['cra', 'inspection'],
    allowedFormats: ['pdf'],
    scopeModel: 'subject',
    evidenceRules: {
      includedTypes: ['consent', 'signatures'],
      excludedTypes: ['clinical_data'],
      versionLogic: 'ALL_EXECUTED_VERSIONS',
    },
  },
  signature_evidence_package: {
    systemCode: 'signature_evidence_package',
    name: 'Signature Evidence Package',
    targetAudience: ['investigator', 'cra', 'inspection'],
    allowedFormats: ['pdf', 'xlsx'],
    scopeModel: 'visit', // Or Study
    evidenceRules: {
      includedTypes: ['signatures'],
      excludedTypes: ['clinical_data'],
      versionLogic: 'ALL_EXECUTED_VERSIONS',
    },
  },
  financial_reconciliation_workbook: {
    systemCode: 'financial_reconciliation_workbook',
    name: 'Financial Reconciliation Workbook',
    targetAudience: ['finance'],
    allowedFormats: ['xlsx'],
    scopeModel: 'study',
    evidenceRules: {
      includedTypes: ['financials'],
      excludedTypes: ['clinical_fields', 'audit_trail'],
      versionLogic: 'ALL_EXECUTED_VERSIONS',
    },
  },
}
