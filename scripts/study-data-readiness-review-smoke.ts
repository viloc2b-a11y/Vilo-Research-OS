/**
 * Study Data Readiness Review smoke.
 *
 * Usage:
 *   npx tsx scripts/study-data-readiness-review-smoke.ts
 *   STUDY_DATA_READINESS_SMOKE_STUDY_ID=<uuid> npx tsx scripts/study-data-readiness-review-smoke.ts
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { evaluateStudyDataReadiness } from '../lib/site-intelligence/study-data-readiness-adapter'

dotenv.config({ path: '.env.local' })

const DEFAULT_STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const DEFAULT_ORGANIZATION_ID = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'

function argValue(flag: string) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function normalizeDatabaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    if (url.hostname.includes('pooler.supabase.com')) {
      const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (apiUrl) {
        const ref = new URL(apiUrl).hostname.split('.')[0]
        url.hostname = `db.${ref}.supabase.co`
        url.port = '5432'
        url.pathname = '/postgres'
        return url.toString()
      }
    }
    return rawUrl
  } catch {
    return rawUrl
  }
}

async function resolveStudy(supabase: ReturnType<typeof createClient>) {
  const explicitStudyId = process.env.STUDY_DATA_READINESS_SMOKE_STUDY_ID ?? argValue('--study-id')
  const explicitOrganizationId = process.env.STUDY_DATA_READINESS_SMOKE_ORGANIZATION_ID ?? argValue('--organization-id')

  if (explicitStudyId && explicitOrganizationId) {
    return { studyId: explicitStudyId, organizationId: explicitOrganizationId }
  }

  if (explicitStudyId) {
    const { data } = await supabase
      .from('studies')
      .select('id, organization_id, name')
      .eq('id', explicitStudyId)
      .maybeSingle()
    if (!data) throw new Error(`Study ${explicitStudyId} not found.`)
    return { studyId: data.id as string, organizationId: data.organization_id as string }
  }

  return { studyId: DEFAULT_STUDY_ID, organizationId: DEFAULT_ORGANIZATION_ID }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  }

  const supabase = createClient(url, key)
  const { studyId, organizationId } = await resolveStudy(supabase)

  const readiness = await evaluateStudyDataReadiness({
    supabase,
    studyId,
    organizationId,
    mode: 'internal_review',
  })

  const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? '')
  if (!dbUrl) {
    throw new Error('DATABASE_URL or DATABASE_URL_DIRECT is required for persistence.')
  }

  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })
  let review: { id: string; created_at: string } | null = null
  try {
    const rows = await sql<{ id: string; created_at: string }[]>`
      insert into public.study_data_readiness_reviews (
        organization_id,
        study_id,
        mode,
        status,
        summary,
        created_by
      )
      values (
        ${organizationId}::uuid,
        ${studyId}::uuid,
        'internal_review',
        ${readiness.status},
        ${sql.json(readiness)},
        '00000000-0000-0000-0000-000000000000'::uuid
      )
      returning id, created_at
    `
    review = rows[0] ?? null
  } finally {
    await sql.end()
  }

  if (!review) {
    throw new Error('Failed to persist review.')
  }

  console.log('Study Data Readiness Review Smoke')
  console.log(`Study: ${readiness.studyName}`)
  console.log(`Study ID: ${studyId}`)
  console.log(`Organization ID: ${organizationId}`)
  console.log(`Status: ${readiness.status}`)
  console.log(`Subjects reviewed: ${readiness.subjectsReviewed}`)
  console.log(`Visits reviewed: ${readiness.visitsReviewed}`)
  console.log(`Blocking issues: ${readiness.blockersCount}`)
  console.log(`Warnings: ${readiness.warningsCount}`)
  console.log(`Saved review ID: ${review.id}`)
  console.log(`Saved at: ${review.created_at}`)
}

main().catch((error: unknown) => {
  console.error('Smoke failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
