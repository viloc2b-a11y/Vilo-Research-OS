import type { CoordinatorFrictionEventType } from '@/lib/coordinator-friction/types'

export type PreventionUxNote = {
  whyThisMatters: string
  whatBlocksCompletion: string
  whatShouldHappenNext: string
  whatMayHappenIfUnresolved: string
}

const notes: Record<CoordinatorFrictionEventType, PreventionUxNote> = {
  repeated_navigation: {
    whyThisMatters: 'The coordinator is moving through too many places to finish one workflow.',
    whatBlocksCompletion: 'The next step is not clear from the current surface.',
    whatShouldHappenNext: 'Return the coordinator to the exact action needed.',
    whatMayHappenIfUnresolved: 'Work may stall before review.',
  },
  abandoned_flow: {
    whyThisMatters: 'A started workflow did not reach completion.',
    whatBlocksCompletion: 'The coordinator may not have a clear recovery path.',
    whatShouldHappenNext: 'Surface a continue where left off action.',
    whatMayHappenIfUnresolved: 'Required work may remain incomplete.',
  },
  unresolved_blocker: {
    whyThisMatters: 'An open blocker is preventing completion.',
    whatBlocksCompletion: 'The blocking condition has not been resolved.',
    whatShouldHappenNext: 'Show the owner and one next action.',
    whatMayHappenIfUnresolved: 'Closeout or signoff may be delayed.',
  },
  repeated_submission_failure: {
    whyThisMatters: 'Repeated failed submissions create rework and uncertainty.',
    whatBlocksCompletion: 'The submission path is not succeeding.',
    whatShouldHappenNext: 'Recover the draft and show the reason in plain language.',
    whatMayHappenIfUnresolved: 'Source completion may stall.',
  },
  excessive_click_path: {
    whyThisMatters: 'Too many clicks increase fatigue and missed steps.',
    whatBlocksCompletion: 'The action is buried behind extra navigation.',
    whatShouldHappenNext: 'Move the action closer to the active workflow.',
    whatMayHappenIfUnresolved: 'The coordinator may abandon the workflow.',
  },
  repeated_open_without_completion: {
    whyThisMatters: 'Repeated opens without completion suggest the workflow is unclear.',
    whatBlocksCompletion: 'The coordinator may not know what is required.',
    whatShouldHappenNext: 'Show the missing requirement and next action.',
    whatMayHappenIfUnresolved: 'The same work may keep resurfacing.',
  },
  stalled_source_completion: {
    whyThisMatters: 'Source completion is needed for readiness and signoff.',
    whatBlocksCompletion: 'Required source content remains unfinished.',
    whatShouldHappenNext: 'Resume source capture at the missing field or section.',
    whatMayHappenIfUnresolved: 'Review may trigger a query.',
  },
  workflow_return_loop: {
    whyThisMatters: 'Looping back to the same workflow indicates unresolved friction.',
    whatBlocksCompletion: 'The workflow is not reaching a stable end state.',
    whatShouldHappenNext: 'Show the unresolved requirement and recovery action.',
    whatMayHappenIfUnresolved: 'Operational continuity may be disrupted.',
  },
  unresolved_signature_delay: {
    whyThisMatters: 'Signoff delays can block review readiness.',
    whatBlocksCompletion: 'A required signature is still pending.',
    whatShouldHappenNext: 'Bundle the signoff request for the accountable signer.',
    whatMayHappenIfUnresolved: 'Signoff may remain blocked.',
  },
  confusion_reopen_pattern: {
    whyThisMatters: 'Repeated reopening suggests terminology or workflow confusion.',
    whatBlocksCompletion: 'The coordinator may not trust the current state.',
    whatShouldHappenNext: 'Clarify the state and show the next safe action.',
    whatMayHappenIfUnresolved: 'The workflow may be reopened repeatedly.',
  },
}

export function preventionUxNoteFor(type: CoordinatorFrictionEventType): PreventionUxNote {
  return notes[type]
}
