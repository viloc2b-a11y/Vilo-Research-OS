import { fetchResponseSetDetail } from '@/lib/api/source/read-client'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { logProcedureOperationalEvent } from '@/lib/operations/logOperationalEvent'
import { formatValuePayload } from '@/lib/source/read-contract/format'
import { buildVisitCloseoutPdfLines } from '@/lib/subject/visits/progress-note/pdf-lines'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

function esc(value: string) {
  return value.replace(/[\\()]/g, '\\$&')
}

function pdfText(lines: string[]) {
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += 44) {
    pages.push(lines.slice(i, i + 44))
  }
  if (pages.length === 0) pages.push(['No procedure data available.'])

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '',
    '3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  const pageObjectIds: number[] = []
  pages.forEach((pageLines, pageIndex) => {
    const pageObjectId = 4 + pageIndex * 2
    const contentObjectId = pageObjectId + 1
    pageObjectIds.push(pageObjectId)
    const body = pageLines
      .map((line, index) => `BT /F1 10 Tf 40 ${760 - index * 16} Td (${esc(line.slice(0, 110))}) Tj ET`)
      .join('\n')
    const stream = Buffer.from(body, 'utf8')
    objects.push(
      `${pageObjectId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >> endobj`,
      `${contentObjectId} 0 obj << /Length ${stream.length} >> stream\n${body}\nendstream endobj`,
    )
  })
  objects[1] = `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >> endobj`

  let offset = '%PDF-1.4\n'.length
  const xref = ['0000000000 65535 f ']
  for (const obj of objects) {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `)
    offset += Buffer.byteLength(`${obj}\n`, 'utf8')
  }
  const xrefStart = offset
  const pdf = `%PDF-1.4\n${objects.join('\n')}\n` +
    `xref\n0 ${objects.length + 1}\n${xref.join('\n')}\n` +
    `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf, 'utf8')
}

export async function generateProcedurePdf(params: {
  supabase: Supabase
  procedureExecutionId: string
  organizationId: string
  actorUserId?: string | null
}) {
  const { data: proc, error } = await params.supabase
    .from('procedure_executions')
    .select(`
      id,
      organization_id,
      study_id,
      visit_id,
      is_signed,
      signed_at,
      signed_by,
      is_locked,
      validation_status,
      procedure_definitions(code,label),
      visits(scheduled_date, study_subject_id, visit_definitions(code,label), study_subjects(subject_identifier), studies(name))
    `)
    .eq('id', params.procedureExecutionId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!proc) return { ok: false as const, error: 'Procedure not found.' }

  const [{ data: set }, { data: notes }] = await Promise.all([
    params.supabase
      .from('source_response_sets')
      .select('id, opened_at, submitted_at')
      .eq('procedure_execution_id', params.procedureExecutionId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    params.supabase
      .from('subject_visit_notes')
      .select('note_text, created_by, created_at')
      .eq('procedure_execution_id', params.procedureExecutionId)
      .order('created_at', { ascending: true }),
  ])

  const detail = set?.id ? await fetchResponseSetDetail(set.id as string, params.organizationId) : null
  const pdef = Array.isArray(proc.procedure_definitions) ? proc.procedure_definitions[0] : proc.procedure_definitions
  const visit = Array.isArray(proc.visits) ? proc.visits[0] : proc.visits
  const vdef = visit ? (Array.isArray(visit.visit_definitions) ? visit.visit_definitions[0] : visit.visit_definitions) : null
  const subject = visit ? (Array.isArray(visit.study_subjects) ? visit.study_subjects[0] : visit.study_subjects) : null
  const study = visit ? (Array.isArray(visit.studies) ? visit.studies[0] : visit.studies) : null

  const closeoutLines = proc.visit_id
    ? await buildVisitCloseoutPdfLines(proc.visit_id as string)
    : []

  const lines = [
    'VILO CTMS Procedure Snapshot',
    `Generated: ${new Date().toISOString()}`,
    `Study: ${study?.name ?? proc.study_id}`,
    `Subject: ${subject?.subject_identifier ?? visit?.study_subject_id ?? ''}`,
    `Visit: ${vdef?.label ?? vdef?.code ?? proc.visit_id} ${visit?.scheduled_date ?? ''}`,
    `Procedure: ${pdef?.label ?? pdef?.code ?? proc.id}`,
    `Response opened: ${set?.opened_at ?? '-'}`,
    `Response submitted: ${set?.submitted_at ?? '-'}`,
    `Signed: ${proc.is_signed ? `Yes ${proc.signed_at ?? ''}` : 'No'}`,
    `Signed by: ${proc.signed_by ?? '-'}`,
    `Locked: ${proc.is_locked ? 'Yes' : 'No'}`,
    `Validation: ${proc.validation_status ?? 'not run'}`,
    '',
    'Entered Fields:',
    ...(detail?.ok && detail.data
      ? detail.data.fields.map((field) => `${field.field_key}: ${field.current_effective ? formatValuePayload(field.current_effective.value) : '-'}`)
      : ['No response set data available.']),
    '',
    'Progress / Operational Notes:',
    ...((notes ?? []).length
      ? (notes ?? []).map((note) => `${note.created_at} ${note.created_by ?? ''}: ${note.note_text}`)
      : ['No procedure notes recorded.']),
    ...closeoutLines,
  ]

  if (params.actorUserId) {
    await logProcedureOperationalEvent({
      supabase: params.supabase,
      procedure: {
        id: proc.id as string,
        organization_id: proc.organization_id as string,
        study_id: proc.study_id as string,
        visit_id: proc.visit_id as string,
      },
      actorUserId: params.actorUserId,
      eventType: OPERATIONAL_EVENT_TYPES.PDF_GENERATED,
      payload: { file_name: `procedure-${params.procedureExecutionId}.pdf` },
    })
  }

  return { ok: true as const, bytes: pdfText(lines), fileName: `procedure-${params.procedureExecutionId}.pdf` }
}
