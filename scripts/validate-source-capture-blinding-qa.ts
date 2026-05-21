/**
 * Validate source capture field blinding (static + optional live API).
 *
 * Usage:
 *   npm run db:validate-source-capture-blinding-qa
 *   npm run db:validate-source-capture-blinding-qa:live
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'
import type { OrganizationMembership } from '../lib/auth/session'
import {
  filterResponseSetDetailForBlinding,
  isUnblindedSourceField,
  loadSourceFieldBlindingMap,
} from '../lib/source/blinding'
import type { ResponseSetDetailData } from '../lib/api/source/read-types'
import {
  canEditClinicalSource,
  canManageSourceDocuments,
  canManageUnblindedData,
  canMutateOrganizationData,
  canSignClinicalSource,
  canViewUnblindedData,
} from '../lib/rbac/permissions'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE_PATH = join(ROOT, 'tmp', 'source-capture-blinding-qa-fixture.json')
const QA_PASSWORD = 'RbacBlindingQa!2026'

type Fixture = {
  organizationId: string
  studyId: string
  studyVersionId: string | null
  studySubjectId: string | null
  visitId: string
  procedureExecutionId: string
  sourceDefinitionVersionId: string
  fields: {
    qa_blinded_field: { id: string; fieldKey: string; blindingScope: string }
    qa_unblinded_field: { id: string; fieldKey: string; blindingScope: string }
  }
  qaUsers: Record<string, string>
  capturePath?: string
}

type PersonaKey =
  | 'research_coordinator'
  | 'data_coordinator'
  | 'unblinded_coordinator'
  | 'unblinded_cra'
  | 'pi_sub_i'
  | 'read_only'
  | 'owner'

function membershipForRole(orgId: string, role: string, roles?: string[]): OrganizationMembership {
  return {
    organization_id: orgId,
    role,
    roles: roles ?? [role],
    status: 'active',
    organizations: null,
  }
}

function buildMockDetail(fixture: Fixture): ResponseSetDetailData {
  const blinded = fixture.fields.qa_blinded_field
  const unblinded = fixture.fields.qa_unblinded_field
  return {
    response_set: {
      id: '00000000-0000-4000-8000-000000000001',
      organization_id: fixture.organizationId,
      study_id: fixture.studyId,
      study_version_id: fixture.studyVersionId ?? fixture.studyId,
      study_subject_id: fixture.studySubjectId ?? fixture.studyId,
      visit_id: fixture.visitId,
      procedure_execution_id: fixture.procedureExecutionId,
      source_definition_version_id: fixture.sourceDefinitionVersionId,
      status: 'open',
      source_origin: 'capture',
      opened_by_user_id: '00000000-0000-4000-8000-000000000002',
      opened_at: new Date().toISOString(),
      submitted_by_user_id: null,
      submitted_at: null,
      reviewed_by_user_id: null,
      reviewed_at: null,
      signed_by_user_id: null,
      signed_at: null,
      locked_by_user_id: null,
      locked_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    fields: [
      {
        source_field_id: blinded.id,
        field_key: blinded.fieldKey,
        blinding_scope: 'blinded',
        widget_hint: 'text',
        is_required: false,
        history: [],
        current_effective: null,
      },
      {
        source_field_id: unblinded.id,
        field_key: unblinded.fieldKey,
        blinding_scope: 'unblinded',
        widget_hint: 'text',
        is_required: false,
        history: [],
        current_effective: null,
      },
    ],
    corrections: [],
    addenda: [],
    placeholders: {},
    lineage: [],
    findings_summary: {
      active: [],
      counts: {
        total: 0,
        open: 0,
        acknowledged: 0,
        resolved: 0,
        waived: 0,
        severity: { info: 0, warning: 0, error: 0 },
      },
    },
  } as unknown as ResponseSetDetailData
}

function expectedForPersona(persona: PersonaKey) {
  const seesUnblinded = ['unblinded_coordinator', 'unblinded_cra', 'owner'].includes(persona)
  const canMutate = !['read_only', 'unblinded_cra'].includes(persona)

  return {
    visibleFieldKeys: seesUnblinded
      ? ['qa_blinded_field', 'qa_unblinded_field']
      : ['qa_blinded_field'],
    canViewUnblinded: seesUnblinded,
    canSaveBlinded: canMutate,
    canSaveUnblinded: ['unblinded_coordinator', 'owner'].includes(persona),
    canSignWithUnblindedOnProcedure: persona === 'owner',
    canMutate,
  }
}

function canSaveBlindedRole(memberships: OrganizationMembership[], orgId: string): boolean {
  return (
    canMutateOrganizationData(memberships, orgId)
    && (canManageSourceDocuments(memberships, orgId) || canEditClinicalSource(memberships, orgId))
  )
}

function evaluatePersona(persona: PersonaKey, orgId: string, detail: ResponseSetDetailData) {
  const memberships = [
    membershipForRole(
      orgId,
      persona === 'owner' ? 'owner' : persona,
      persona === 'owner' ? ['owner'] : [persona],
    ),
  ]
  const canViewUnblinded = canViewUnblindedData(memberships, orgId)
  const filtered = filterResponseSetDetailForBlinding(detail, canViewUnblinded)
  const visibleKeys = filtered.fields.map((f) => f.field_key).sort()
  const exp = expectedForPersona(persona)
  const bugs: string[] = []

  const expectedKeys = [...exp.visibleFieldKeys].sort()
  if (JSON.stringify(visibleKeys) !== JSON.stringify(expectedKeys)) {
    bugs.push(`visible fields: expected ${expectedKeys.join(', ')}, got ${visibleKeys.join(', ') || '(none)'}`)
  }
  if (canViewUnblinded !== exp.canViewUnblinded) {
    bugs.push(`canViewUnblinded expected ${exp.canViewUnblinded}, got ${canViewUnblinded}`)
  }
  if (canSaveBlindedRole(memberships, orgId) !== exp.canSaveBlinded) {
    bugs.push(`canSaveBlinded mismatch`)
  }
  const canSaveUnblinded =
    canManageUnblindedData(memberships, orgId)
    && (canManageSourceDocuments(memberships, orgId) || canEditClinicalSource(memberships, orgId))
  if (canSaveUnblinded !== exp.canSaveUnblinded) {
    bugs.push(`canSaveUnblinded expected ${exp.canSaveUnblinded}, got ${canSaveUnblinded}`)
  }
  const expectCanSign = persona === 'pi_sub_i' || persona === 'owner'
  if (canSignClinicalSource(memberships, orgId) !== expectCanSign) {
    bugs.push(`canSignClinicalSource expected ${expectCanSign} for ${persona}`)
  }
  const canSignUnblindedProcedure =
    canSignClinicalSource(memberships, orgId)
    && (!detail.fields.some((f) => isUnblindedSourceField({ fieldKey: f.field_key, blindingScope: f.blinding_scope }))
      || canViewUnblinded)
  if (canSignUnblindedProcedure !== exp.canSignWithUnblindedOnProcedure) {
    bugs.push(`PI/sign with unblinded on procedure expected ${exp.canSignWithUnblindedOnProcedure}`)
  }

  return {
    persona,
    visibleFieldKeys: visibleKeys.join(', ') || '(none)',
    canViewUnblinded,
    canMutate: canMutateOrganizationData(memberships, orgId),
    canSaveBlinded: canSaveBlindedRole(memberships, orgId),
    canSaveUnblinded,
    canSignClinical: canSignClinicalSource(memberships, orgId),
    canSignUnblindedProcedure,
    pass: bugs.length === 0 ? 'PASS' : 'FAIL',
    bugs,
  }
}

async function liveApiChecks(fixture: Fixture, baseUrl: string) {
  const { signInForCookieHeader, apiFetch } = await import('./lib/source-api-e2e.mjs')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const rows: Record<string, unknown>[] = []
  const blindedId = fixture.fields.qa_blinded_field.id
  const unblindedId = fixture.fields.qa_unblinded_field.id

  for (const [persona, email] of Object.entries(fixture.qaUsers)) {
    if (persona === 'read_only') continue
    const { cookieHeader } = await signInForCookieHeader(supabaseUrl, anonKey, {
      email,
      password: QA_PASSWORD,
    })

    const openResult = await apiFetch(baseUrl, '/api/source/response-set/open', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: fixture.organizationId,
        study_id: fixture.studyId,
        study_version_id: fixture.studyVersionId,
        study_subject_id: fixture.studySubjectId,
        visit_id: fixture.visitId,
        procedure_execution_id: fixture.procedureExecutionId,
        source_definition_version_id: fixture.sourceDefinitionVersionId,
      },
    })
    const openBody = openResult.json as { ok?: boolean; data?: { source_response_set_id?: string } }
    const responseSetId = openBody?.data?.source_response_set_id

    let detailKeys: string[] = []
    let openStatus = openResult.httpStatus
    if (responseSetId) {
      const detailResult = await apiFetch(
        baseUrl,
        `/api/source/response-set/${responseSetId}?organization_id=${fixture.organizationId}`,
        { cookieHeader },
      )
      const detailBody = detailResult.json as { data?: { fields?: { field_key: string }[] } }
      detailKeys = (detailBody?.data?.fields ?? []).map((f) => f.field_key).sort()
    } else if (!openBody?.ok) {
      openStatus = openResult.httpStatus
    }

    let saveBlindedStatus: number | null = null
    let saveUnblindedStatus: number | null = null
    if (responseSetId) {
      const saveBlinded = await apiFetch(baseUrl, '/api/source/response-set/save-draft', {
        method: 'POST',
        cookieHeader,
        body: {
          organization_id: fixture.organizationId,
          source_response_set_id: responseSetId,
          responses: [{ source_field_id: blindedId, value: { value_text: `qa-${persona}-blinded` } }],
        },
      })
      saveBlindedStatus = saveBlinded.httpStatus

      const saveUnblinded = await apiFetch(baseUrl, '/api/source/response-set/save-draft', {
        method: 'POST',
        cookieHeader,
        body: {
          organization_id: fixture.organizationId,
          source_response_set_id: responseSetId,
          responses: [{ source_field_id: unblindedId, value: { value_text: `qa-${persona}-unblinded` } }],
        },
      })
      saveUnblindedStatus = saveUnblinded.httpStatus
    }

    const exp = expectedForPersona(persona as PersonaKey)
    const bugs: string[] = []
    if (!responseSetId) {
      const errMsg =
        (openResult.json as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
        (openBody as { code?: string })?.code ??
        'n/a'
      bugs.push(`open failed http=${openStatus}: ${errMsg}`)
    } else {
      for (const key of exp.visibleFieldKeys) {
        if (!detailKeys.includes(key)) bugs.push(`detail missing QA field: ${key}`)
      }
      if (!exp.canViewUnblinded && detailKeys.includes('qa_unblinded_field')) {
        bugs.push('detail must hide qa_unblinded_field')
      }
    }
    if (saveBlindedStatus != null) {
      const expectOk = exp.canSaveBlinded
      if (expectOk && saveBlindedStatus !== 200) bugs.push(`save blinded expected 200, got ${saveBlindedStatus}`)
      if (!expectOk && saveBlindedStatus === 200) bugs.push(`save blinded should be denied`)
    }
    if (saveUnblindedStatus != null) {
      const expectOk = exp.canSaveUnblinded
      if (expectOk && saveUnblindedStatus !== 200) bugs.push(`save unblinded expected 200, got ${saveUnblindedStatus}`)
      if (!expectOk && saveUnblindedStatus >= 200 && saveUnblindedStatus < 300) {
        bugs.push(`save unblinded should be denied (got ${saveUnblindedStatus})`)
      }
    }

    rows.push({
      persona,
      responseSetId: responseSetId ?? '(open failed)',
      detailFieldKeys: detailKeys.join(', ') || '(none)',
      saveBlindedStatus,
      saveUnblindedStatus,
      pass: bugs.length === 0 ? 'PASS' : 'FAIL',
      bugs: bugs.join('; '),
    })
  }
  return rows
}

async function verifyDbBlindingMap(fixture: Fixture): Promise<string | null> {
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const map = await loadSourceFieldBlindingMap(admin, [
    fixture.fields.qa_blinded_field.id,
    fixture.fields.qa_unblinded_field.id,
  ])
  const blinded = map.get(fixture.fields.qa_blinded_field.id)?.blindingScope
  const unblinded = map.get(fixture.fields.qa_unblinded_field.id)?.blindingScope
  if (blinded !== 'blinded' || unblinded !== 'unblinded') {
    return `DB blinding map unavailable or stale: blinded=${blinded}, unblinded=${unblinded}. Run npm run db:seed-source-capture-blinding-qa before live DB validation.`
  }
  return null
}

function requireEnv(keys: string[]) {
  for (const key of keys) {
    if (!process.env[key]?.trim()) throw new Error(`Missing env: ${key}`)
  }
}

async function main() {
  loadEnvFiles()
  const live = process.argv.includes('--live')
  const baseUrl = process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000'

  if (!existsSync(FIXTURE_PATH)) {
    throw new Error(`Missing fixture — run: npm run db:seed-source-capture-blinding-qa`)
  }
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture

  let dbMapWarning: string | null = null
  try {
    dbMapWarning = await verifyDbBlindingMap(fixture)
  } catch (err) {
    dbMapWarning = err instanceof Error ? err.message : String(err)
  }

  if (dbMapWarning && live) {
    throw new Error(dbMapWarning)
  }

  const detail = buildMockDetail(fixture)
  const personas: PersonaKey[] = [
    'research_coordinator',
    'data_coordinator',
    'unblinded_coordinator',
    'unblinded_cra',
    'pi_sub_i',
    'read_only',
    'owner',
  ]

  console.log('Fixture procedure:', fixture.procedureExecutionId)
  console.log('Capture path:', fixture.capturePath ?? `/source/capture/${fixture.procedureExecutionId}`)
  if (dbMapWarning) {
    console.warn(`DB check skipped for static run: ${dbMapWarning}`)
  }

  const staticTable = personas.map((p) => evaluatePersona(p, fixture.organizationId, detail))
  console.log('\n--- Static blinding matrix (read model + RBAC) ---')
  console.table(staticTable)

  const staticBugs = staticTable.flatMap((r) =>
    r.pass === 'FAIL' ? [`${r.persona}: ${r.bugs.join('; ')}`] : [],
  )

  let liveBugs: string[] = []
  if (live) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY required for --live')
    }
    console.log(`\n--- Live API matrix (${baseUrl}) ---`)
    const liveTable = await liveApiChecks(fixture, baseUrl)
    console.table(liveTable)
    liveBugs = liveTable.flatMap((r) =>
      r.pass === 'FAIL' ? [`${r.persona}: ${r.bugs}`] : [],
    )
  } else {
    console.log('\n(Skipping live API — pass --live to run save-draft/detail checks)')
  }

  const allBugs = [...staticBugs, ...liveBugs]
  if (allBugs.length) {
    console.log('\nBUGS:')
    for (const b of allBugs) console.log(`  - ${b}`)
    process.exit(1)
  }
  console.log('\nPASS  Source capture blinding QA')
}

main().catch((err) => {
  console.error(`FAIL  ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
