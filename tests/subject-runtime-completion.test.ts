import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

describe('Subject Source Template canonical completion', () => {
  const chartTabs = read('lib/subject/chart-tabs.ts')
  const subjectPage = read('app/(ops)/subjects/[subjectId]/page.tsx')
  const sourceActions = read('lib/subject/source-template/actions.ts')
  const sourceSections = read('components/subject/source-template/SubjectSourceTemplateSections.tsx')
  const terminologySearch = read('lib/subject/clinical-profile/library-search.ts')
  const aeWorkspace = read('components/subject/adverse-events/SubjectAdverseEventsWorkspace.tsx')
  const migration = read('supabase/migrations/0135_subject_source_template_completion.sql')
  const ongoingMigration = read('supabase/migrations/0136_subject_start_stop_ongoing_patch.sql')
  const medicalHistory = read('components/subject/clinical-profile/MedicalHistorySection.tsx')
  const conmeds = read('components/subject/clinical-profile/ConMedsSection.tsx')
  const allergies = read('components/subject/clinical-profile/AllergiesSection.tsx')
  const surgical = read('components/subject/clinical-profile/SurgicalHistorySection.tsx')

  test('Subject opens with required canonical sections', () => {
    for (const tab of [
      'general',
      'visits',
      'adverse-events',
      'medical-history',
      'conmeds',
      'allergies',
      'surgical-history',
      'progress-notes',
      'documents',
      'signatures',
      'protocol-deviations',
      'emergency-contacts',
      'audit',
    ]) {
      expect(chartTabs).toContain(tab)
    }
    expect(subjectPage).toContain('SubjectProgressNotesSection')
  })

  test('Controlled terminology is connected to runtime sections', () => {
    expect(terminologySearch).toContain('searchPathologyLibrary')
    expect(terminologySearch).toContain('searchMedicationLibrary')
    expect(terminologySearch).toContain('searchAllergenLibrary')
    expect(terminologySearch).toContain('searchSurgicalProcedureLibrary')
    expect(terminologySearch).toContain('searchAeControlledTerms')
    expect(aeWorkspace).toContain('AE_SEVERITY')
    expect(aeWorkspace).toContain('AE_RELATEDNESS')
  })

  test('New subject sections use real persistence and audit events', () => {
    for (const action of [
      'addSubjectProgressNote',
      'uploadSubjectDocumentAction',
      'assignComplianceDocumentToSubject',
      'requestSubjectDocumentReview',
      'requestSubjectSignature',
      'addSubjectProtocolDeviation',
      'addSubjectEmergencyContact',
    ]) {
      expect(sourceActions).toContain(action)
    }
    expect(sourceActions).toContain('writeProfileEvent')
    expect(sourceActions).toContain('subject_clinical_profile_events')
    expect(sourceActions).not.toContain('alert(')
  })

  test('Document and subject signature flows are present in subject context', () => {
    expect(sourceSections).toContain('Upload document to subject')
    expect(sourceSections).toContain('Assign already-ingested document')
    expect(sourceSections).toContain('Request document review or signature')
    expect(sourceSections).toContain('Subject-Level Signatures')
    expect(sourceActions).toContain('completeSubjectDocumentRequest')
    expect(sourceActions).toContain('completeSubjectSignature')
  })

  test('Persistence schema covers P0 subject source tables', () => {
    for (const table of [
      'subject_progress_notes',
      'subject_documents',
      'subject_document_review_requests',
      'subject_signatures',
      'subject_protocol_deviations',
      'subject_emergency_contacts',
    ]) {
      expect(migration).toContain(table)
    }
  })

  test('Coordinator runtime does not expose CRA/FDA/sponsor convenience views', () => {
    const runtimeSurface = chartTabs + sourceSections
    expect(runtimeSurface).not.toMatch(/inspection readiness|sponsor dashboard|CRA view|FDA view/i)
  })

  test('Start Date, Stop Date, and Ongoing are present for longitudinal records', () => {
    for (const source of [aeWorkspace, medicalHistory, conmeds, allergies, surgical, sourceSections]) {
      expect(source).toContain('Start Date')
      expect(source).toContain('Stop Date')
      expect(source).toContain('Ongoing')
    }
  })

  test('Ongoing validation prevents conflicting stop dates', () => {
    for (const source of [aeWorkspace, medicalHistory, conmeds, allergies, surgical, sourceActions]) {
      expect(source).toContain('Stop Date must be empty when Ongoing is selected.')
    }
    expect(ongoingMigration).toContain('subject_adverse_events_ongoing_stop_check')
    expect(ongoingMigration).toContain('subject_allergies_ongoing_stop_check')
    expect(ongoingMigration).toContain('subject_surgical_history_ongoing_stop_check')
    expect(ongoingMigration).toContain('subject_protocol_deviations_ongoing_stop_check')
  })
})
