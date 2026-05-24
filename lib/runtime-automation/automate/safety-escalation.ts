import type { ProposedAutomationAction } from '@/lib/runtime-automation/types'

export function buildSafetyEscalationWorkflow(input: {
  action: ProposedAutomationAction
  studySubjectId: string
}): {
  title: string
  description: string
  assignedRole: 'pi'
  priority: 'urgent' | 'high'
  actionType: 'follow_up'
} {
  return {
    title: 'Safety review — runtime automation',
    description: `PI review required: ${input.action.detail} (subject ${input.studySubjectId.slice(0, 8)}…)`,
    assignedRole: 'pi',
    priority: input.action.priority >= 85 ? 'urgent' : 'high',
    actionType: 'follow_up',
  }
}
