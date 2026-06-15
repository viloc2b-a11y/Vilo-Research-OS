export type ExportRole =
  | 'org_admin'
  | 'pi'
  | 'coordinator'
  | 'sponsor'
  | 'cra'
  | 'auditor'
  | 'read_only'

export type ExportReportType =
  | 'subject_list'
  | 'visit_summary'
  | 'financial_summary'
  | 'deviation_report'
  | 'safety_report'
  | 'audit_trail'
  | 'sponsor_dashboard'
  | 'lab_report'

export type MaskLevel = 'none' | 'partial' | 'full'

export type FieldMaskPolicy = {
  maskLevel: MaskLevel
  maskedFields: string[]
}

const PHI_FIELDS = [
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'date_of_birth',
  'address',
  'ssn',
  'mrn',
  'insurance_id',
]

const FINANCIAL_PHI_FIELDS = [
  'bank_account',
  'routing_number',
  'payment_details',
]

const IDENTIFIABLE_FIELDS = [
  'subject_identifier',
  'study_subject_id',
]

function resolvePolicy(role: ExportRole, reportType: ExportReportType): FieldMaskPolicy {
  // Org admin and PI see everything
  if (role === 'org_admin' || role === 'pi') {
    return { maskLevel: 'none', maskedFields: [] }
  }

  // Sponsor gets de-identified aggregate views only
  if (role === 'sponsor') {
    if (reportType === 'sponsor_dashboard' || reportType === 'financial_summary') {
      return { maskLevel: 'partial', maskedFields: [...PHI_FIELDS, ...IDENTIFIABLE_FIELDS] }
    }
    return { maskLevel: 'full', maskedFields: [...PHI_FIELDS, ...IDENTIFIABLE_FIELDS, ...FINANCIAL_PHI_FIELDS] }
  }

  // CRA sees subject identifiers but not contact PHI
  if (role === 'cra') {
    return { maskLevel: 'partial', maskedFields: PHI_FIELDS }
  }

  // Coordinator sees all clinical data but not payment PHI
  if (role === 'coordinator') {
    if (reportType === 'financial_summary') {
      return { maskLevel: 'partial', maskedFields: FINANCIAL_PHI_FIELDS }
    }
    return { maskLevel: 'none', maskedFields: [] }
  }

  // Auditor sees everything except financial PHI
  if (role === 'auditor') {
    return { maskLevel: 'partial', maskedFields: FINANCIAL_PHI_FIELDS }
  }

  // Read-only: full PHI mask on all reports
  return { maskLevel: 'full', maskedFields: [...PHI_FIELDS, ...IDENTIFIABLE_FIELDS, ...FINANCIAL_PHI_FIELDS] }
}

export function getFieldMaskPolicy(role: ExportRole, reportType: ExportReportType): FieldMaskPolicy {
  return resolvePolicy(role, reportType)
}

export function isExportRole(value: string): value is ExportRole {
  const roles: ExportRole[] = ['org_admin', 'pi', 'coordinator', 'sponsor', 'cra', 'auditor', 'read_only']
  return roles.includes(value as ExportRole)
}

export function isExportReportType(value: string): value is ExportReportType {
  const types: ExportReportType[] = [
    'subject_list', 'visit_summary', 'financial_summary', 'deviation_report',
    'safety_report', 'audit_trail', 'sponsor_dashboard', 'lab_report',
  ]
  return types.includes(value as ExportReportType)
}
