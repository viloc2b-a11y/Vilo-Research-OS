import { computeStudyReadiness, type StudyReadiness } from './study-readiness'

/**
 * Load comprehensive study readiness by aggregating all domain evaluators.
 *
 * Uses real loaders for integrated domains (regulatory, source, pharmacy, budget)
 * and default placeholder evaluators for remaining domains (lab, systems, training, contract).
 */
export async function loadStudyReadiness(studyId: string): Promise<StudyReadiness> {
  // Load real domains in parallel
  const [regulatory, source, pharmacy, budget] = await Promise.all([
    import('./regulatory-readiness').then((m) => m.loadRegulatoryReadinessDomain(studyId)),
    import('./source-readiness').then((m) => m.loadSourceReadinessDomain(studyId)),
    import('./pharmacy-readiness').then((m) => m.loadPharmacyReadinessDomain(studyId)),
    import('./budget-readiness').then((m) => m.loadBudgetReadinessDomain(studyId)),
  ])

  // Build evaluator map — real domains use loaded data, placeholders stay as defaults
  const evaluators = {
    regulatory: () => regulatory,
    source: () => source,
    pharmacy: () => pharmacy,
    budget: () => budget,
    // Remaining domains use default all-ready placeholders from the core engine
    lab: () => import('./study-readiness').then((m) => m.evaluateLabReadiness(studyId)),
    systems: () => import('./study-readiness').then((m) => m.evaluateSystemsReadiness(studyId)),
    training: () => import('./study-readiness').then((m) => m.evaluateTrainingReadiness(studyId)),
    contract: () => import('./study-readiness').then((m) => m.evaluateContractReadiness(studyId)),
  }

  return computeStudyReadiness(studyId, evaluators)
}
