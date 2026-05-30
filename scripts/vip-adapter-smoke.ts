/**
 * VIP adapter smoke.
 *
 * Usage:
 *   npx tsx scripts/vip-adapter-smoke.ts
 *   npx tsx scripts/vip-adapter-smoke.ts --live
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateVipDraft } from '../lib/vip-adapter'

const LIVE = process.argv.includes('--live')

type QueryResult = { data?: unknown; error?: { message: string } | null; count?: number | null }

const fixture = {
  studies: [
    {
      id: 'prs-vip-smoke-001',
      organization_id: 'org-vip-smoke-001',
      study_id: 'study-vip-smoke-001',
      protocol_number: 'VIP-SMOKE-001',
      protocol_title: 'VIP Adapter Smoke Protocol',
      sponsor_name: 'Vilo Research',
      therapeutic_area: 'General Medicine',
      phase: 'Phase 2',
      indication: 'Validation',
      protocol_status: 'ready_for_generation',
      current_protocol_version_id: 'prv-vip-smoke-001',
      source_document_id: 'doc-vip-smoke-001',
      metadata: {},
      created_by: 'vip-smoke',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  versions: [
    {
      id: 'prv-vip-smoke-001',
      protocol_runtime_study_id: 'prs-vip-smoke-001',
      version_label: 'Protocol v1.0',
      amendment_number: null,
      version_date: '2026-05-29',
      source_document_id: 'doc-vip-smoke-001',
      raw_text: {},
      extraction_status: 'ready',
      extraction_metadata: {},
      previous_version_id: null,
      created_by: 'vip-smoke',
      created_at: new Date().toISOString(),
      protocol_runtime_studies: { organization_id: 'org-vip-smoke-001' },
    },
  ],
  sections: [
    {
      id: 'sec-vip-smoke-001',
      protocol_version_id: 'prv-vip-smoke-001',
      section_code: '2',
      section_title: 'Schedule of Activities',
      section_type: 'schedule_of_activities',
      sequence_order: 1,
      extracted_text: 'Screening Visit: informed consent, demographics, medical history, vitals, ECG.',
      extraction_confidence: 0.91,
      requires_review: false,
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ],
  visits: [
    {
      id: 'visit-vip-smoke-screening',
      protocol_version_id: 'prv-vip-smoke-001',
      visit_code: 'SCR',
      visit_name: 'Screening Visit',
      visit_type: 'screening',
      study_day: -28,
      window_before_days: 0,
      window_after_days: 28,
      extracted_from_section_id: 'sec-vip-smoke-001',
      confidence_score: 0.94,
      reconciliation_status: 'approved',
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ],
  procedures: [
    'Informed consent',
    'Demographics',
    'Medical history',
    'Vital signs',
    '12-lead ECG',
    'Eligibility review',
  ].map((name, index) => ({
    id: `proc-vip-smoke-${index + 1}`,
    protocol_version_id: 'prv-vip-smoke-001',
    visit_candidate_id: 'visit-vip-smoke-screening',
    procedure_name: name,
    procedure_category: 'screening',
    extracted_text: name,
    confidence_score: 0.9,
    matched_procedure_library_id: null,
    matched_blueprint_version_id: null,
    reconciliation_status: 'approved',
    metadata: {},
    created_at: new Date().toISOString(),
  })),
  amendments: [],
}

class FixtureQuery {
  private filters: { column: string; value: string }[] = []
  private single = false
  private countOnly = false

  constructor(
    private table: string,
    private data: typeof fixture,
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.countOnly = Boolean(options?.head)
    return this
  }

  eq(column: string, value: string) {
    this.filters.push({ column, value })
    return this
  }

  or() {
    return this
  }

  order() {
    return this
  }

  maybeSingle() {
    this.single = true
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected)
  }

  private rows() {
    const tableRows =
      this.table === 'protocol_runtime_studies'
        ? this.data.studies
        : this.table === 'protocol_runtime_versions'
          ? this.data.versions
          : this.table === 'protocol_runtime_sections'
            ? this.data.sections
            : this.table === 'protocol_runtime_visit_candidates'
              ? this.data.visits
              : this.table === 'protocol_runtime_procedure_candidates'
                ? this.data.procedures
                : this.data.amendments

    return tableRows.filter((row) =>
      this.filters.every((filter) => String(row[filter.column as keyof typeof row]) === filter.value),
    )
  }

  private async execute(): Promise<QueryResult> {
    const rows = this.rows()
    if (this.countOnly) return { data: null, error: null, count: rows.length }
    if (this.single) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }
}

function createFixtureSupabase() {
  return {
    from(table: string) {
      return new FixtureQuery(table, fixture)
    },
  } as unknown as SupabaseClient
}

async function writeArtifact(result: Awaited<ReturnType<typeof generateVipDraft>>) {
  const outputDir = path.join(process.cwd(), 'tmp', 'vip-adapter')
  const outputPath = path.join(outputDir, 'screening-visit-source-draft.json')
  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(result.artifact, null, 2)}\n`, 'utf8')
  return outputPath
}

async function runFixture() {
  const result = await generateVipDraft({
    supabase: createFixtureSupabase(),
    organizationId: 'org-vip-smoke-001',
    studyId: 'study-vip-smoke-001',
    protocolRuntimeStudyId: 'prs-vip-smoke-001',
    traceId: 'vip-smoke-fixture-trace',
  })

  const outputPath = await writeArtifact(result)
  console.log('✅ VIP adapter fixture draft generated')
  console.log(`trace_id=${result.traceId}`)
  console.log(`fallback=${result.fallback}`)
  console.log(`artifact=${outputPath}`)
}

function readRequestJson(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function withMockVipServer<T>(run: (baseUrl: string) => Promise<T>) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST' || req.url !== '/drafts/source-documents') {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
      return
    }

    const body = await readRequestJson(req)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        artifact: {
          title: 'Mock VIP Screening Visit Source Draft',
          source_document: {
            visit_name: 'Screening Visit',
            sections: [
              {
                title: 'Mock VIP procedures',
                fields: [
                  {
                    label: 'Mock VIP generated field',
                    type: 'checkbox',
                    required: true,
                    source: 'vip',
                  },
                ],
              },
            ],
          },
          metadata: {
            mock_vip: true,
            received_trace_id: body.trace_id,
            received_organization_id: body.organization_id,
            received_study_id: body.study_id,
          },
        },
      }),
    )
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Failed to start mock VIP server')
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

async function runLiveClientHarness() {
  const originalBaseUrl = process.env.VIP_BASE_URL
  try {
    await withMockVipServer(async (baseUrl) => {
      process.env.VIP_BASE_URL = baseUrl
      const result = await generateVipDraft({
        supabase: createFixtureSupabase(),
        organizationId: 'org-vip-smoke-001',
        studyId: 'study-vip-smoke-001',
        protocolRuntimeStudyId: 'prs-vip-smoke-001',
        traceId: 'vip-smoke-live-client-trace',
      })

      if (result.fallback) {
        throw new Error('Expected live VIP client harness to generate without fallback')
      }

      const outputPath = await writeArtifact(result)
      console.log('✅ VIP adapter live client harness generated draft')
      console.log(`trace_id=${result.traceId}`)
      console.log(`fallback=${result.fallback}`)
      console.log(`artifact=${outputPath}`)
    })
  } finally {
    if (originalBaseUrl === undefined) {
      delete process.env.VIP_BASE_URL
    } else {
      process.env.VIP_BASE_URL = originalBaseUrl
    }
  }
}

async function runLive() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const organizationId = process.env.VIP_SMOKE_ORG_ID
  const studyId = process.env.VIP_SMOKE_STUDY_ID
  const protocolRuntimeStudyId = process.env.VIP_SMOKE_PROTOCOL_RUNTIME_STUDY_ID
  const protocolVersionId = process.env.VIP_SMOKE_PROTOCOL_VERSION_ID

  if (!url || !key || !organizationId || !studyId || !protocolRuntimeStudyId) {
    console.log('Live Supabase smoke env is not complete; running local live VIP client harness')
    await runLiveClientHarness()
    return
  }

  const result = await generateVipDraft({
    supabase: createClient(url, key),
    organizationId,
    studyId,
    protocolRuntimeStudyId,
    protocolVersionId,
    traceId: process.env.VIP_SMOKE_TRACE_ID ?? 'vip-smoke-live-trace',
  })

  const outputPath = await writeArtifact(result)
  console.log('✅ VIP adapter live draft generated')
  console.log(`trace_id=${result.traceId}`)
  console.log(`fallback=${result.fallback}`)
  console.log(`artifact=${outputPath}`)
}

async function main() {
  if (LIVE) {
    await runLive()
    return
  }

  await runFixture()
}

main().catch((error) => {
  console.error('VIP adapter smoke failed:', error)
  process.exit(1)
})
