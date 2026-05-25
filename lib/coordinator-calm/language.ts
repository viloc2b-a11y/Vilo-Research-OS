/**
 * Operational calm language — coordinator-facing copy only (never external).
 */

const HOSTILE_TERMS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bviolation(s)?\b/gi, replacement: 'readiness gap' },
  { pattern: /\bfailure(s)?\b/gi, replacement: 'needs review' },
  { pattern: /\benforcement\b/gi, replacement: 'stabilization' },
  { pattern: /\bnoncompliance\b/gi, replacement: 'readiness risk' },
  { pattern: /\bnon-compliance\b/gi, replacement: 'readiness risk' },
  { pattern: /\bescalation triggered\b/gi, replacement: 'recovery recommended' },
  { pattern: /\bmonitoring issue\b/gi, replacement: 'readiness review' },
  { pattern: /\baudit problem\b/gi, replacement: 'evidence review' },
  { pattern: /\bdeviation detected\b/gi, replacement: 'chronology needs review' },
  { pattern: /\bblocked by policy\b/gi, replacement: 'completion blocked' },
  { pattern: /\bfailed\b/gi, replacement: 'incomplete' },
  { pattern: /\berror\b/gi, replacement: 'needs attention' },
]

const DIRECT_REPLACEMENTS: Record<string, string> = {
  'Resolve unsigned procedures': 'Signoff pending',
  'Complete missing source capture': 'Source continuity incomplete',
  'Review safety or governance blockers': 'Safety or governance needs review',
  'High deviation risk': 'Chronology needs review',
  'Missing source continuity': 'Source continuity incomplete',
  'Unresolved escalation': 'Workflow recovery recommended',
  'Evidence readiness needs review': 'Stabilization needed',
  'Signoff readiness needs attention': 'Signoff pending',
  'Finding prevention': 'Prevention focus',
}

export function toCoordinatorSafeOperationalLanguage(text: string): string {
  let out = text.trim()
  if (!out) return out

  if (DIRECT_REPLACEMENTS[out]) return DIRECT_REPLACEMENTS[out]

  for (const { pattern, replacement } of HOSTILE_TERMS) {
    out = out.replace(pattern, replacement)
  }

  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim()
}

export function isCoordinatorHostileLanguage(text: string): boolean {
  const lower = text.toLowerCase()
  return HOSTILE_TERMS.some(({ pattern }) => {
    pattern.lastIndex = 0
    return pattern.test(lower)
  })
}
