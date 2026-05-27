/**
 * K1 smoke: Document Intelligence Ingestion Foundation
 */
import fs from 'node:fs'
import path from 'node:path'
import { chunkDocumentText, MAX_CHUNKS_PER_DOC } from '../lib/document-intelligence/document-chunker'
import { cleanDocumentText } from '../lib/document-intelligence/document-text-cleaner'
import { hashBuffer, hashChunkText, hashQueryText } from '../lib/document-intelligence/document-hash-utils'
import { isEmbeddingAvailable } from '../lib/document-intelligence/openai-embeddings'
import {
  normalizeDocumentClassification,
  resolveAppliedDomains,
  resolveDefaultDomains,
} from '../lib/document-intelligence/document-domain-mapper'
import { scanPhiRisk } from '../lib/document-intelligence/scan-phi-risk'
import { classifyDocumentIntelligence } from '../lib/document-intelligence/classify-document-intelligence'
import { resolveIngestClassification } from '../lib/document-intelligence/resolve-ingest-classification'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runChecks() {
  console.log('--- Document Intelligence K1 checks ---')

  const cleaned = cleanDocumentText(
    'Contact jane.doe@site.org MRN: 123456789 phone 555-123-4567',
  )
  assert(cleaned.includes('[REDACTED_EMAIL]'), 'cleanText removes email')
  assert(cleaned.includes('[REDACTED_PHONE]'), 'cleanText removes phone')
  assert(!cleaned.includes('jane.doe@site.org'), 'email not in cleaned output')

  const docId = '00000000-0000-4000-8000-000000000001'
  const paragraph = 'Operational visit procedures must be reviewed before runtime generation. '.repeat(40)
  const text = `${paragraph}\n\n${paragraph}\n\n# Section Three\n\n${paragraph}`
  const chunks = chunkDocumentText(text, docId)
  assert(chunks.length >= 2, 'chunker creates multiple chunks for long text')
  const hashA = hashChunkText(chunks[0].cleanChunkText, 0, docId)
  const hashB = hashChunkText(chunks[0].cleanChunkText, 0, docId)
  assert(hashA === hashB, 'chunk_hash deterministic')

  if (chunks.length >= 2) {
    const overlap = chunks[1].cleanChunkText.slice(0, 20)
    assert(
      chunks[0].cleanChunkText.includes(overlap.slice(0, 8)) || overlap.length < 8,
      'chunks have overlap or are distinct sections',
    )
  }

  const blob = Buffer.from('same-content')
  const hash1 = hashBuffer(blob)
  const hash2 = hashBuffer(Buffer.from('same-content'))
  assert(hash1 === hash2, 'source hash stable for same blob')
  assert(hash1 !== hashBuffer(Buffer.from('changed')), 'source hash changes when blob changes')

  assert(
    isEmbeddingAvailable() === Boolean(process.env.OPENAI_API_KEY?.trim()),
    'embedding gate reads env',
  )
  if (!process.env.OPENAI_API_KEY) {
    console.log('✅ Embeddings skipped without OPENAI_API_KEY (expected in CI)')
  }

  const queryHash = hashQueryText('Protocol visit schedule')
  assert(queryHash.length === 64, 'query hash is sha256 hex')
  assert(!queryHash.includes('Protocol'), 'query hash does not store raw query')

  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0122_document_intelligence_ingestion.sql'),
    'utf8',
  )
  const trgmMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0123_document_intelligence_trgm_search.sql'),
    'utf8',
  )
  assert(migration.includes('using hnsw'), 'migration uses hnsw index')
  assert(migration.includes('gin_trgm_ops'), 'migration uses pg_trgm')
  assert(trgmMigration.includes('clean_chunk_text % search_query'), 'trgm uses % operator')
  assert(!/\bilike\b/i.test(trgmMigration.replace(/--[^\n]*/g, '')), 'trgm search does not use ilike')
  assert(trgmMigration.includes('similarity(c.clean_chunk_text, search_query) >= 0.3'), 'trgm threshold')
  assert(
    migration.includes('unique (compliance_document_id, source_hash)'),
    'unique on compliance_document_id + source_hash',
  )
  assert(!migration.includes('unique (compliance_document_id)'), 'no unique on compliance_document_id alone')
  assert(
    !migration.includes('organization_id = auth.uid()'),
    'RLS does not use organization_id = auth.uid()',
  )
  assert(
    migration.includes('user_has_active_organization_membership'),
    'RLS uses org membership helper',
  )

  const extractSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/document-intelligence/extract-text-from-compliance-document.ts'),
    'utf8',
  )
  const ingestSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/document-intelligence/ingest-compliance-document.ts'),
    'utf8',
  )
  assert(extractSource.includes('createSupabaseAdmin'), 'storage uses service-role admin client')
  assert(extractSource.includes('.storage'), 'loads from Supabase storage')

  const ingestRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/document-intelligence/ingest/route.ts'),
    'utf8',
  )
  assert(ingestRoute.includes('maxDuration = 60'), 'ingest route sets maxDuration')
  assert(ingestRoute.includes("status: 'processing'"), 'ingest returns processing status')

  const searchSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/document-intelligence/search-document-intelligence.ts'),
    'utf8',
  )
  assert(searchSource.includes('assertK1SingleStudyScope'), 'search enforces K1 single study scope')

  const scopeSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/document-intelligence/document-intelligence-scope.ts'),
    'utf8',
  )
  assert(scopeSource.includes('single_study'), 'K1 scope mode defined')
  assert(scopeSource.includes('cross_study_portfolio'), 'future cross-study scope type only (not implemented)')
  assert(!scopeSource.includes('export async function searchCrossStudy'), 'no cross-study search implementation')
  assert(!ingestSource.includes('process.cwd()'), 'no filesystem scanning in ingest')
  assert(!ingestSource.includes('readdir'), 'no directory crawling')

  assert(MAX_CHUNKS_PER_DOC === 800, 'chunk limit guardrail constant')

  assert(normalizeDocumentClassification('Protocol PDF') === 'protocol_pdf', 'classification normalize')
  const protocolDefaults = resolveDefaultDomains('protocol')
  assert(protocolDefaults.includes('source_creation'), 'protocol maps source_creation default')
  assert(protocolDefaults.includes('budget_analysis'), 'protocol maps budget_analysis default')

  const sopDefaults = resolveDefaultDomains('sop')
  assert(sopDefaults.includes('training'), 'sop maps training default')

  const unknownDefaults = resolveDefaultDomains('unknown_type')
  assert(unknownDefaults.length === 1 && unknownDefaults[0] === 'general_library', 'fallback general_library')

  const defaultsOnly = resolveAppliedDomains('protocol', [])
  assert(
    defaultsOnly.join(',') === protocolDefaults.join(','),
    'empty explicit domains uses defaults only',
  )

  const merged = resolveAppliedDomains('sop', ['budget_analysis', 'budget_analysis'])
  assert(merged.includes('training'), 'explicit merges with defaults')
  assert(merged.includes('budget_analysis'), 'explicit domain included in merge')
  assert(new Set(merged).size === merged.length, 'duplicate domains deduplicated')

  const domainsMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0124_document_intelligence_domains.sql'),
    'utf8',
  )
  assert(
    domainsMigration.includes('unique (intelligence_document_id, domain)'),
    'domain unique per intelligence document',
  )
  assert(
    !domainsMigration.replace(/--[^\n]*/g, '').includes('organization_id = auth.uid()'),
    'domain RLS does not use organization_id = auth.uid()',
  )
  assert(
    domainsMigration.includes('user_has_active_organization_membership'),
    'domain RLS uses org membership',
  )
  assert(
    domainsMigration.includes('filter_domain is null') &&
      domainsMigration.includes('document_intelligence_domains dom'),
    'search RPC uses EXISTS domain filter',
  )
  assert(
    domainsMigration.includes('document_intelligence_domains_study_domain_active_idx'),
    'partial index study_id domain active',
  )

  console.log('✅ Text cleaning')
  console.log('✅ Chunking + deterministic hash')
  console.log('✅ Version hash idempotency primitives')
  console.log('✅ Migration hnsw + pg_trgm + RLS patterns')
  console.log('✅ No filesystem scanning in ingest path')
  console.log('✅ Chunk limit guardrail')
  console.log('✅ Domain mapper defaults, merge, dedupe')
  console.log('✅ Domain migration + search EXISTS filter')

  const versionMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0127_document_intelligence_version_control.sql'),
    'utf8',
  )
  assert(versionMigration.includes('document_family_id'), 'version control adds document_family_id')
  assert(
    versionMigration.includes('document_intelligence_active_references'),
    'active references table',
  )
  assert(
    versionMigration.includes('document_family_id, study_id, domain'),
    'unique active per family study domain',
  )
  assert(
    versionMigration.includes('filter_include_superseded'),
    'search RPC supports include superseded filter',
  )
  assert(
    versionMigration.includes('document_intelligence_active_reference_events'),
    'audit log for active reference changes',
  )

  const setActiveSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/document-intelligence/set-active-document-reference.ts'),
    'utf8',
  )
  assert(
    setActiveSource.includes('runtime_mutated: false'),
    'set active reference documents no runtime mutation',
  )
  assert(
    !setActiveSource.includes('publish_source_package'),
    'set active does not publish source',
  )

  const extractEvidence = fs.readFileSync(
    path.join(process.cwd(), 'lib/source-blueprint-evidence/extract-evidence-from-intelligence.ts'),
    'utf8',
  )
  assert(
    extractEvidence.includes('assertActiveDocumentReferenceForDomain'),
    'evidence extract requires active reference',
  )
  assert(
    extractEvidence.includes('source_document_version_id'),
    'evidence provenance snapshots document version',
  )

  console.log('✅ Version control migration + active reference workflow')
  console.log('✅ Search defaults to active reference; evidence version snapshot')

  const safeguardsMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0128_document_intelligence_ingest_safeguards.sql'),
    'utf8',
  )
  assert(safeguardsMigration.includes("'quarantine'"), 'quarantine intelligence status')
  assert(safeguardsMigration.includes('quarantine_reason'), 'quarantine_reason jsonb')
  assert(safeguardsMigration.includes('document_intelligence_phi_override_events'), 'PHI audit table')

  const phiScan = scanPhiRisk('Contact jane.doe@example.org MRN: ABC-123456789')
  assert(phiScan.exceedsThreshold, 'PHI scan flags email+MRN sample')
  assert(phiScan.findings.length >= 1, 'PHI findings recorded')

  const protocolClass = classifyDocumentIntelligence({
    filename: 'Protocol_v3.1_Final.pdf',
    textSample: 'Schedule of assessments and investigator responsibilities.',
    metadataClassification: 'general',
  })
  assert(protocolClass.confidence >= 0.85, 'protocol filename+text auto tier')
  assert(protocolClass.tier === 'auto_apply', 'high confidence auto_apply')

  const resolved = resolveIngestClassification({
    filename: 'Protocol_v3.1_Final.pdf',
    extractedText: 'Schedule of assessments.',
    complianceClassification: 'general',
    explicitDomains: null,
  })
  assert(resolved.appliedClassification === 'protocol', 'auto classification applied at ingest')

  const processSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/document-intelligence/process-intelligence-text-ingest.ts'),
    'utf8',
  )
  assert(processSource.includes('scanPhiRisk'), 'ingest runs PHI gate before chunking')
  assert(processSource.includes('INTELLIGENCE_STATUS.QUARANTINE'), 'quarantine stops chunk/embed')

  console.log('✅ PHI quarantine gate + rule-based classification')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Document Intelligence K1 smoke test passed.')
