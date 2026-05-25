/**
 * Phase 16E-1 — Audited routes touching source or runtime intelligence.
 */

export const AUDITED_SOURCE_API_ROUTES = [
  'GET /api/source/response-set/[id]',
  'GET /api/source/response-set/[id]/manifest',
  'GET /api/source/response-set/[id]/history',
  'GET /api/source/response-set/[id]/findings',
  'POST /api/source/response-set/open',
  'POST /api/source/response-set/save-draft',
  'POST /api/source/response-set/submit',
  'POST /api/source/response-set/addendum',
  'POST /api/source/response/correct',
  'POST /api/source/findings/create',
  'POST /api/source/findings/acknowledge',
  'POST /api/source/findings/resolve',
  'POST /api/source/findings/waive',
] as const

export const AUDITED_RUNTIME_SURFACES = [
  'GET /command-center (SSR)',
  'GET /performance/* (SSR)',
  'GET /visits/[visitId] orchestration loaders',
  'lib/coordinator-operations/load-*',
  'lib/runtime-ui/load',
] as const

export const EXTERNAL_DTO_ONLY_ROUTES = [
  'GET /api/source/response-set/[id] (external actor branch)',
] as const

export const EXTERNAL_DENIED_ROUTES = [
  'GET /api/source/response-set/[id]/manifest',
  'GET /api/source/response-set/[id]/history',
  'All source POST mutations for external actors',
  'All runtime projection queries for external actors',
] as const
