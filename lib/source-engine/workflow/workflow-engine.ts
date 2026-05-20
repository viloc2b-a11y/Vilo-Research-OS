/**
 * Workflow engine — materializes CREATE_TASK rule actions into coordinator tasks.
 */

import type { RuleDefinition } from '@/lib/source-engine/definitions/types'
import { evaluateRules } from '@/lib/source-engine/rules/rule-engine'
import type { RuntimeContext, SourceResponses } from '@/lib/source-engine/runtime/runtime-context'
import type { SourceTemplateDefinition } from '@/lib/source-engine/definitions/types'
import type { WorkflowEvaluationResult, WorkflowTask, WorkflowTaskKind } from '@/lib/source-engine/workflow/workflow.types'

function taskFromAction(
  action: { taskKind?: string; message?: string; fieldId?: string; sectionId?: string },
  context: RuntimeContext,
): WorkflowTask | null {
  if (!action.taskKind) return null
  return {
    id: `task_${action.taskKind}_${Date.now()}`,
    kind: action.taskKind as WorkflowTaskKind,
    title: action.message ?? action.taskKind,
    subjectId: context.subjectId,
    visitId: context.visitId,
    fieldId: action.fieldId,
    sectionId: action.sectionId,
    priority: 'normal',
    status: 'open',
    createdAt: new Date().toISOString(),
  }
}

export function evaluateWorkflowTasks(
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): WorkflowEvaluationResult {
  const evaluation = evaluateRules(template, rules, responses, context)
  const tasks: WorkflowTask[] = []

  for (const action of evaluation.actions) {
    if (action.type !== 'CREATE_TASK') continue
    const task = taskFromAction(action, context)
    if (task) tasks.push(task)
  }

  return { tasks }
}
