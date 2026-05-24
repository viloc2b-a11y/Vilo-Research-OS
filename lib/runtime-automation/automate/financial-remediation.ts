import type { ProposedAutomationAction } from '@/lib/runtime-automation/types'

export function buildFinancialRemediationWorkflow(input: {
  action: ProposedAutomationAction
}): {
  title: string
  description: string
  assignedRole: 'crc'
  priority: 'high' | 'normal'
  actionType: 'follow_up' | 'correction'
} {
  const isSource =
    input.action.detail.toLowerCase().includes('source')
    || input.action.label.toLowerCase().includes('source')

  return {
    title: 'Financial leakage remediation',
    description: input.action.detail,
    assignedRole: 'crc',
    priority: input.action.priority >= 80 ? 'high' : 'normal',
    actionType: isSource ? 'correction' : 'follow_up',
  }
}
