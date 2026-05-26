import type { DestinationDomain } from './compliance-types'

export function validateDestinationMetadata(input: {
  destinationDomain: string | null
  destinationEntityType: string | null
  destinationEntityId: string | null
}): { ok: boolean; message?: string } {
  if (!input.destinationDomain?.trim()) {
    return { ok: false, message: 'Destination domain is required.' }
  }
  if (!input.destinationEntityType?.trim()) {
    return { ok: false, message: 'Destination entity type is required.' }
  }

  const needsEntityId = ['subject', 'visit', 'procedure'].includes(input.destinationEntityType)
  if (needsEntityId && !input.destinationEntityId?.trim()) {
    return {
      ok: false,
      message: 'Destination entity id is required for subject, visit, and procedure targets.',
    }
  }

  const allowedDomains: DestinationDomain[] = [
    'source_builder',
    'regulatory_binder',
    'budget_contract',
    'study_documents',
    'subject_chart',
    'visit_workspace',
    'procedure_execution',
  ]
  if (!allowedDomains.includes(input.destinationDomain as DestinationDomain)) {
    return { ok: false, message: 'Destination domain is not supported.' }
  }

  return { ok: true }
}
