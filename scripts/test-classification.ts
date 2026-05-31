import * as fs from 'fs'
import * as path from 'path'

const HEADING_RE = /^((\d+(\.\d+)*)|appendix\s+[a-z0-9]+)?\s*([A-Z][^\n]{3,120})\s*$/gim

const file = 'fixtures/protocol-intake/demo-vaccine-protocol.txt'
const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')

function classifySection(title: string) {
  const t = title.toLowerCase()
  if (t.includes('schedule of activities') || t.includes('soa')) return 'schedule_of_activities'
  if (t.includes('visit schedule') || t.includes('schedule')) return 'visit_schedule'
  if (t.includes('procedure') || t.includes('assessment')) return 'procedure_section'
  if (t.includes('eligibility') || t.includes('inclusion') || t.includes('exclusion')) return 'eligibility'
  if (t.includes('safety') || t.includes('adverse')) return 'safety'
  if (t.includes('lab')) return 'labs'
  if (t.includes('endpoint')) return 'endpoints'
  if (t.includes('investigational product') || t.includes('ip ') || t.includes('drug')) return 'ip_management'
  if (t.includes('statistic') || t.includes('analysis')) return 'statistics'
  return 'other'
}

for (const match of text.matchAll(HEADING_RE)) {
  const title = match[4].trim()
  console.log(`Heading: "${title}" -> ${classifySection(title)}`)
}
