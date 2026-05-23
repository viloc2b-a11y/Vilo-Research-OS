import { createServerClient } from '@/lib/supabase/server'
import { generateProcedurePdf } from './generateProcedurePdf'
import { logAuditEvent } from '@/lib/audit/log'
import crypto from 'crypto'

export async function snapshotVisitProcedures(visitId: string, actorUserId: string) {
  const supabase = await createServerClient()
  
  // 1. Get visit context
  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select('organization_id, study_id, study_subject_id')
    .eq('id', visitId)
    .single()
    
  if (visitErr || !visit) {
    console.error(`Snapshot failed: could not load visit ${visitId}`)
    return
  }

  // 2. Get procedure executions
  const { data: procedures, error: procsErr } = await supabase
    .from('procedure_executions')
    .select('id')
    .eq('visit_id', visitId)
    
  if (procsErr || !procedures?.length) return

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  for (const proc of procedures) {
    // 3. Generate PDF
    const pdfResult = await generateProcedurePdf({
      supabase,
      procedureExecutionId: proc.id,
      organizationId: visit.organization_id,
      actorUserId, // logs PDF_GENERATED internal to generateProcedurePdf
    })

    if (!pdfResult.ok || !pdfResult.bytes) continue

    // 4. Compute Hash for Lineage
    const hash = crypto.createHash('sha256').update(pdfResult.bytes).digest('hex')
    const fileName = `snapshot_${proc.id}_${timestamp}.pdf`
    const filePath = `snapshots/${visitId}/${fileName}`

    // 5. Upload to immutable storage bucket (visit-documents)
    const { error: uploadErr } = await supabase.storage
      .from('visit-documents')
      .upload(filePath, pdfResult.bytes, {
        contentType: 'application/pdf',
        upsert: false // Prevent overwrite!
      })

    if (uploadErr) {
      console.error(`Upload failed for ${proc.id}:`, uploadErr.message)
      continue
    }

    // 6. Register artifact in DB
    const metadata = JSON.stringify({
      snapshot_type: 'procedure_execution',
      source_id: proc.id,
      sha256_hash: hash,
      generated_at: timestamp
    })

    await supabase.from('subject_visit_documents').insert({
      org_id: visit.organization_id,
      study_id: visit.study_id,
      study_subject_id: visit.study_subject_id,
      subject_visit_id: visitId,
      document_type: 'Source Document',
      file_name: fileName,
      file_path: filePath,
      mime_type: 'application/pdf',
      file_size: pdfResult.bytes.length,
      uploaded_by: actorUserId,
      notes: `Immutable Snapshot Metadata: ${metadata}`
    })

    // 7. Log snapshot creation audit event
    await logAuditEvent({
      organizationId: visit.organization_id,
      actorUserId,
      action: 'SNAPSHOT_GENERATED',
      target: proc.id,
      metadata: {
        visit_id: visitId,
        file_path: filePath,
        hash,
      }
    })
  }
}
