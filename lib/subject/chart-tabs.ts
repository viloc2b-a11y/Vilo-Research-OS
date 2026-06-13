export const subjectChartTabs = [
  { key: 'general', label: 'General' },
  { key: 'subject-status', label: 'Status History' },
  { key: 'visits', label: 'Visits' },
  { key: 'consent', label: 'Consent' },
  { key: 'adverse-events', label: 'AE' },
  { key: 'safety', label: 'Safety' },
  { key: 'medical-history', label: 'Medical History' },
  { key: 'conmeds', label: 'ConMeds' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'surgical-history', label: 'Surgical History' },
  { key: 'progress-notes', label: 'Progress Notes' },
  { key: 'labs', label: 'Labs' },
  { key: 'documents', label: 'eDocs & Misc' },
  { key: 'signatures', label: 'Signatures' },
  { key: 'emergency-contacts', label: 'Emergency Contacts' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'audit', label: 'Audit Trail' },
] as const

export type SubjectChartTabKey = (typeof subjectChartTabs)[number]['key']
