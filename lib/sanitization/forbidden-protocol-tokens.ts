export const FORBIDDEN_PROTOCOL_TOKENS = [
  'F. Hoffmann-La Roche',
  'Pentosan Polysulfate Sodium',
  'baloxavir marboxil',
  'PARA_OA_012',
  'Paradigm',
  'MV40618',
  'Roche',
  'Baloxavir',
  'PPS',
] as const

export type ForbiddenProtocolToken = (typeof FORBIDDEN_PROTOCOL_TOKENS)[number]

export const DEFAULT_PROTOCOL_ALIAS_MAP: Record<ForbiddenProtocolToken, string> = {
  PARA_OA_012: 'STUDY-KOA-001',
  MV40618: 'STUDY-INF-001',
  Paradigm: 'Sponsor-A',
  Roche: 'Sponsor-B',
  'F. Hoffmann-La Roche': 'Sponsor-B',
  PPS: 'Compound-X',
  'Pentosan Polysulfate Sodium': 'Compound-X',
  Baloxavir: 'Compound-Y',
  'baloxavir marboxil': 'Compound-Y',
}

export const PUBLISH_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER =
  'Publish blocked: unsafe protocol identifier detected.'

export const EXPORT_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER =
  'Export blocked: unsafe protocol identifier detected.'

export const RUNTIME_REJECTED_UNSAFE_PROTOCOL_IDENTIFIER =
  'Runtime rejected: unsafe protocol identifier detected.'
