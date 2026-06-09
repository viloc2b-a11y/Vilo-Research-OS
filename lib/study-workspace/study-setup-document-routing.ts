// Study Setup document routing map.
//
// Classification is PERSISTED at upload time in
// `compliance_runtime_documents.document_classification` (NOT NULL enum, see
// lib/document-intake/compliance-types.ts -> DocumentClassification). Routing is
// derived from that persisted value only. We do NOT infer routing from filenames.
//
// Enabled destinations only ever point at routes/surfaces that already exist:
//   - Protocol / Amendment      -> Protocol runtime + Source Runtime / Published Source
//   - Lab Manual                 -> Protocol runtime + Source Runtime / Published Source
//   - ICF / Consent              -> Consent Management workspace section + consent runtime
//   - Source / eCRF              -> Source Evidence / Source Builder
//   - Lab / Pharmacy / Imaging / Budget / CTA -> Document Intelligence (indexed evidence)
//
// Everything else stays "Queued / Not wired yet" (no structured parser exists)
// or "Needs classification" so we never render dead-end buttons. `destinationKind`
// tells the panel which existing study-scoped link to use; the panel owns the
// final href so study scope stays consistent.

export type StudySetupRouteStatus = 'enabled' | 'queued' | 'needs_classification'

export type StudySetupDestinationKind =
  | 'protocol'
  | 'consent_management'
  | 'regulatory_binder'
  | 'source_evidence'
  | 'document_intelligence'
  | 'none'

export type StudySetupDestination = {
  destinationLabel: string
  /** Plain-language description of what this document produces today. */
  outputLabel: string
  routeStatus: StudySetupRouteStatus
  destinationKind: StudySetupDestinationKind
  actionLabel: string | null
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  protocol: 'Protocol',
  protocol_amendment: 'Protocol Amendment',
  lab_result: 'Lab Result',
  lab_manual: 'Lab Manual',
  imaging: 'Imaging',
  pharmacy_document: 'Pharmacy',
  source_document: 'Source / eCRF',
  financial_document: 'Budget / CTA',
  regulatory_document: 'Regulatory / ICF',
  icf_consent: 'ICF / Consent',
  investigator_brochure: 'Investigator Brochure',
  training_material: 'Training Material',
  delegation_document: 'Delegation',
  safety_document: 'Safety',
  vendor_document: 'Vendor',
  monitoring_document: 'Monitoring',
  external_medical_record: 'External Medical Record',
  site_communication: 'Site Communication',
  other: 'Other',
}

export function classificationLabel(classification: string | null | undefined): string {
  if (!classification) return 'Unclassified'
  return CLASSIFICATION_LABELS[classification] ?? classification
}

/**
 * Map a persisted document classification to its intended Study Setup destination.
 * Only destinations backed by a real, existing route expose an enabled action.
 */
export function resolveDocumentDestination(
  classification: string | null | undefined,
): StudySetupDestination {
  switch (classification) {
    case 'protocol':
    case 'protocol_amendment':
    case 'lab_manual':
      return {
        destinationLabel: 'Source Runtime / Published Source',
        outputLabel: 'Runtime / Source workflow',
        routeStatus: 'enabled',
        destinationKind: 'protocol',
        actionLabel: 'Continue Setup',
      }
    case 'icf_consent':
      return {
        destinationLabel: 'Consent Management / ICF Governance',
        outputLabel: 'Consent template library / subject consent workflow',
        routeStatus: 'enabled',
        destinationKind: 'consent_management',
        actionLabel: 'Open Consent Management',
      }
    case 'regulatory_document':
      return {
        destinationLabel: 'Regulatory Binder / Documents & Compliance',
        outputLabel: 'Binder entry / compliance tracking',
        routeStatus: 'enabled',
        destinationKind: 'regulatory_binder',
        actionLabel: 'Open Regulatory Binder',
      }
    case 'source_document':
      return {
        destinationLabel: 'Source Evidence / Source Builder',
        outputLabel: 'Source evidence / worksheet support',
        routeStatus: 'enabled',
        destinationKind: 'source_evidence',
        actionLabel: 'Open Source Evidence / Builder',
      }
    case 'lab_result':
    case 'pharmacy_document':
    case 'imaging':
    case 'financial_document':
      return {
        destinationLabel: 'Document Intelligence (indexed evidence)',
        outputLabel: 'Indexed evidence only',
        routeStatus: 'enabled',
        destinationKind: 'document_intelligence',
        actionLabel: 'Open Document Intelligence',
      }
    case 'investigator_brochure':
    case 'safety_document':
      return queued('Regulatory / Safety Reference')
    case 'training_material':
      return queued('Startup / Regulatory Training Requirements')
    case 'delegation_document':
      return queued('Delegation Log / Signatures')
    case 'vendor_document':
      return queued('Vendor / Lab / Imaging Setup')
    case 'monitoring_document':
      return queued('Monitoring View')
    case 'external_medical_record':
      return queued('Subject Chart / Source')
    case 'site_communication':
      return queued('Study Documents')
    case 'other':
    case null:
    case undefined:
    case '':
      return needsClassification()
    default:
      return needsClassification()
  }
}

function queued(destinationLabel: string): StudySetupDestination {
  return {
    destinationLabel,
    outputLabel: 'Not wired yet',
    routeStatus: 'queued',
    destinationKind: 'none',
    actionLabel: null,
  }
}

function needsClassification(): StudySetupDestination {
  return {
    destinationLabel: 'Needs classification',
    outputLabel: 'Needs classification',
    routeStatus: 'needs_classification',
    destinationKind: 'none',
    actionLabel: null,
  }
}
