/**
 * Rule-based PHI risk scan on raw extracted text (pre-chunking).
 * Not certified de-identification — operational gate for clinical ingest safety.
 */

export const PHI_RISK_THRESHOLD = 0.35

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g
const MRN_PATTERN = /\b(?:MRN|medical record|patient id)[:\s#-]*[A-Z0-9-]{6,}\b/gi
const DOB_PATTERN =
  /\b(?:DOB|date of birth|born on)[:\s]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi
const NAME_LIKE_PATTERN =
  /\b(?:patient|subject)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g

export type PhiFinding = {
  type: string
  count: number
  weight: number
}

export type PhiScanResult = {
  riskScore: number
  exceedsThreshold: boolean
  findings: PhiFinding[]
  scannedCharCount: number
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern)
  return matches?.length ?? 0
}

export function scanPhiRisk(rawText: string): PhiScanResult {
  const text = rawText.trim()
  const scannedCharCount = text.length
  if (!text) {
    return { riskScore: 0, exceedsThreshold: false, findings: [], scannedCharCount: 0 }
  }

  const rules: Array<{ type: string; pattern: RegExp; weight: number }> = [
    { type: 'email', pattern: EMAIL_PATTERN, weight: 0.2 },
    { type: 'phone', pattern: PHONE_PATTERN, weight: 0.15 },
    { type: 'ssn', pattern: SSN_PATTERN, weight: 0.35 },
    { type: 'mrn', pattern: MRN_PATTERN, weight: 0.3 },
    { type: 'dob', pattern: DOB_PATTERN, weight: 0.25 },
    { type: 'name_like', pattern: NAME_LIKE_PATTERN, weight: 0.2 },
  ]

  const findings: PhiFinding[] = []
  let riskScore = 0

  for (const rule of rules) {
    const count = countMatches(text, rule.pattern)
    if (count === 0) continue
    const contribution = Math.min(0.95, rule.weight * Math.min(count, 5))
    riskScore += contribution
    findings.push({ type: rule.type, count, weight: rule.weight })
  }

  riskScore = Math.min(1, Math.round(riskScore * 100) / 100)

  return {
    riskScore,
    exceedsThreshold: riskScore >= PHI_RISK_THRESHOLD,
    findings,
    scannedCharCount,
  }
}

export function buildQuarantineReason(
  scan: PhiScanResult,
  ingestionRunId?: string | null,
): Record<string, unknown> {
  return {
    gate: 'pre_ingest_phi',
    risk_score: scan.riskScore,
    threshold: PHI_RISK_THRESHOLD,
    findings: scan.findings,
    scanned_char_count: scan.scannedCharCount,
    ingestion_run_id: ingestionRunId ?? null,
    quarantined_at: new Date().toISOString(),
  }
}
