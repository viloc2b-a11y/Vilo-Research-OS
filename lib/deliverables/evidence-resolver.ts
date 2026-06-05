import { SupabaseClient } from '@supabase/supabase-js'
import { DeliverableRun, PrintableSourcePacketEvidence, PrintableSourceSignatureEvidence, VisitScope, SubjectScope, ConsentEvidencePackageEvidence } from './types'
import { logDeliverableAuditEvent } from './audit'

export class EvidenceResolver {
  
  static async resolveForPrintableSourcePacket(supabase: SupabaseClient, run: DeliverableRun): Promise<PrintableSourcePacketEvidence> {
    const visitScope = run.filters as VisitScope

    if (!visitScope?.visitInstanceId) {
      throw new Error('visit_instance_id is required for Printable Source Packet')
    }

    // 1. Resolve Visit Instance
    const { data: visit, error: visitError } = await supabase
      .from('visit_runtime_instances')
      .select('*, studies(name), study_subjects(subject_identifier)')
      .eq('id', visitScope.visitInstanceId)
      .single()

    if (visitError || !visit) {
      throw new Error(`Failed to resolve visit instance: ${visitError?.message}`)
    }

    // 2. Validate strict VERSION_USED_DURING_EXECUTION logic
    if (!visit.source_package_id) {
      await logDeliverableAuditEvent({
        supabase,
        runId: run.id,
        action: 'run_failed',
        actorId: run.runBy,
        metadata: { error: 'REQUIRES_REVIEW: Missing source_package_id' }
      })
      await supabase.from('deliverable_runs').update({ run_status: 'failed' }).eq('id', run.id)
      throw new Error('REQUIRES_REVIEW: Missing source_package_id in visit instance.')
    }

    // 3. Resolve Source Package
    const { data: sourcePackage } = await supabase
      .from('runtime_source_packages')
      .select('id, package_version, status')
      .eq('id', visit.source_package_id)
      .single()

    // 4. Resolve Procedure Instances
    const { data: proceduresData } = await supabase
      .from('procedure_runtime_instances')
      .select('*')
      .eq('visit_instance_id', visit.id)
      .order('procedure_order', { ascending: true })

    const procIds = (proceduresData || []).map(p => p.id)

    // 5. Resolve Operational Signatures (Phase 4 Hydration)
    const { data: signaturesData } = await supabase
      .from('operational_signatures')
      .select('artifact_type, artifact_id, signer_name_snapshot, signer_role_snapshot, signature_meaning, signed_at, signed_artifact_hash')
      .eq('status', 'signed')
      .in('artifact_id', procIds.length > 0 ? procIds : ['00000000-0000-0000-0000-000000000000'])

    const signaturesByArtifactId = (signaturesData || []).reduce((acc, sig) => {
      if (!acc[sig.artifact_id]) acc[sig.artifact_id] = []
      acc[sig.artifact_id].push({
        signer: sig.signer_name_snapshot || 'Unknown Signer',
        role: sig.signer_role_snapshot || 'Unknown Role',
        meaning: sig.signature_meaning,
        signedAt: sig.signed_at,
        hash: sig.signed_artifact_hash
      })
      return acc
    }, {} as Record<string, PrintableSourceSignatureEvidence[]>)

    const procedures = (proceduresData || []).map(proc => {
      // Mocking extraction of fields from JSONB since we don't have the full blueprint context here,
      // but typically we'd map field_values to PrintableSourceFieldEvidence array
      const fields = Object.entries(proc.field_values || {}).map(([key, value]) => ({
        label: key,
        value: String(value),
        isInternal: false,
      }))

      return {
        id: proc.id,
        name: proc.procedure_name,
        status: proc.procedure_status,
        completedAt: proc.completed_at,
        fields,
        signatures: signaturesByArtifactId[proc.id] || [],
      }
    })

    return {
      studyHeader: {
        studyId: visit.study_id,
        protocolId: visit.studies?.name || 'Unknown Protocol',
      },
      subjectIdentifier: visit.study_subjects?.subject_identifier || 'Unknown Subject',
      visitInfo: {
        visitName: visit.visit_name,
        visitDate: visit.started_at,
        status: visit.visit_status,
      },
      sourcePackage: {
        id: visit.source_package_id,
        name: `Version ${sourcePackage?.package_version || 'Unknown'}`,
        versionUsedLogic: 'VERSION_USED_DURING_EXECUTION'
      },
      procedures,
      attachments: [], // Fetch from visit_documents if they exist
      auditReferences: [], 
      warnings: [],
    }
  }

  static async resolveForConsentEvidencePackage(supabase: SupabaseClient, run: DeliverableRun): Promise<ConsentEvidencePackageEvidence> {
    const subjectScope = run.filters as SubjectScope
    
    if (!subjectScope?.subjectId) {
      throw new Error('subject_id is required for Consent Evidence Package')
    }

    // 1. Resolve Subject and Study
    const { data: subject, error: subjectError } = await supabase
      .from('study_subjects')
      .select('*, studies(name)')
      .eq('id', subjectScope.subjectId)
      .single()
      
    if (subjectError || !subject) {
      throw new Error(`Failed to resolve subject: ${subjectError?.message}`)
    }
    
    // 2. Resolve Master Consent Documents
    const { data: documentsData } = await supabase
      .from('consent_document_versions')
      .select('*')
      .eq('study_id', subjectScope.studyId)
      
    // 3. Resolve Subject Consent Versions
    const { data: subjectVersionsData } = await supabase
      .from('subject_consent_versions')
      .select('*')
      .eq('study_subject_id', subjectScope.subjectId)
      .order('created_at', { ascending: false })

    // 4. Resolve Signatures (Patient and Staff)
    // Patient Signatures
    const { data: patientSignaturesData } = await supabase
      .from('subject_consent_patient_signatures')
      .select('*')
      .eq('study_subject_id', subjectScope.subjectId)
      
    // Staff Signatures (Operational)
    const { data: operationalSignaturesData } = await supabase
      .from('operational_signatures')
      .select('*')
      .eq('subject_id', subjectScope.subjectId)
      .in('artifact_type', ['initial_consent', 're_consent', 'amendment_consent', 'consent'])

    // 5. Resolve Reconsent Requirements
    const { data: reconsentData } = await supabase
      .from('subject_consent_reconsent_requirements')
      .select('*')
      .eq('study_subject_id', subjectScope.subjectId)
      .eq('reconsent_status', 'pending')

    // 6. Resolve Attachments / Documents
    const { data: attachmentsData } = await supabase
      .from('subject_consent_documents')
      .select('*')
      .eq('study_subject_id', subjectScope.subjectId)

    // 7. Map Data to Package Type
    const currentActive = (subjectVersionsData || []).find(v => v.status === 'active')
    const currentStatus = currentActive ? 'active' : (subjectVersionsData && subjectVersionsData.length > 0 ? subjectVersionsData[0].status : 'pending')
    const requiresReconsent = (reconsentData || []).length > 0
    
    const documents = (documentsData || []).map(doc => ({
      id: doc.id,
      versionName: doc.version_label || `v${doc.version_number}`,
      consentType: doc.consent_type,
      irbApprovalDate: doc.irb_approval_date,
      effectiveDate: doc.effective_date,
      expirationDate: doc.expiration_date,
      status: doc.status
    }))

    const signatures = []
    for (const sig of (patientSignaturesData || [])) {
      signatures.push({
        signer: sig.signer_name,
        role: sig.signer_type,
        meaning: 'Patient Consent',
        method: sig.signature_method,
        signedAt: sig.signed_at,
      })
    }
    
    for (const sig of (operationalSignaturesData || [])) {
      signatures.push({
        signer: sig.signer_name_snapshot || 'Unknown',
        role: sig.signer_role_snapshot || 'Staff',
        meaning: sig.signature_meaning,
        method: sig.verification_method || 'electronic',
        signedAt: sig.signed_at,
        hash: sig.signed_artifact_hash
      })
    }
    
    const attachments = (attachmentsData || []).map(att => ({
      id: att.id,
      filename: att.file_name,
      uploadedAt: att.linked_at,
      isCurrent: true 
    }))
    
    const timeline = (subjectVersionsData || []).map(sv => ({
      id: sv.id,
      type: (sv.consent_type === 'initial_consent' ? 'original' : (sv.consent_type === 'amendment_consent' ? 'amendment' : 'reconsent')) as 'original' | 'amendment' | 'reconsent' | 'withdrawal',
      date: sv.created_at,
      status: sv.status,
      documentVersionId: sv.consent_document_version_id,
      versionName: sv.consent_version_label
    }))

    return {
      studyHeader: {
        studyId: subject.study_id,
        protocolId: subject.studies?.name || 'Unknown Protocol',
      },
      subjectIdentifier: subject.subject_identifier,
      statusSummary: {
        currentStatus,
        requiresReconsent
      },
      timeline,
      documents,
      signatures,
      attachments,
      auditReferences: [],
      warnings: []
    }
  }
}

