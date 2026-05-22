export const subjectChartTabs = [
  { key: 'general', label: 'General' },
  { key: 'visits', label: 'Visits' },
  { key: 'clinical-profile', label: 'Clinical Profile' },
  { key: 'conmeds', label: 'ConMeds' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'adverse-events', label: 'AE' },
  { key: 'deviations', label: 'Deviations' },
] as const

export type SubjectChartTabKey = (typeof subjectChartTabs)[number]['key']
