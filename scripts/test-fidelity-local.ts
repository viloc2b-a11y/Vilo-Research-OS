import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const VISIT_LINE_RE = /^(Visit\s*\d+|V\d+|Week\s*\d+|Day\s*-?\d+|Screening|Baseline|Follow[- ]?up|EOS|ET)\s*[-:–]\s*([A-Za-z0-9][^\n]{2,80})/gim

const files = [
  'fixtures/protocol-intake/para-oa-012-protocol-excerpt.txt',
  'fixtures/protocol-intake/mv40618-protocol-excerpt.txt',
  'validation-corpus/sanitized/protocols/PROTOCOL_A001.txt',
  'validation-corpus/sanitized/protocols/PROTOCOL_A002.txt',
  'fixtures/protocol-intake/demo-vaccine-protocol.txt',
  'fixtures/protocol-intake/demo-oncology-protocol.txt'
]

for (const file of files) {
  const filepath = path.join(__dirname, '..', file)
  if (!fs.existsSync(filepath)) continue
  const text = fs.readFileSync(filepath, 'utf8')
  
  const visits = []
  for (const match of text.matchAll(VISIT_LINE_RE)) {
     visits.push(match[2].trim())
  }
  
  const procs = []
  const procRegex = /^Procedure\s*[-:–]\s*([A-Za-z0-9][^\n]{2,80})/gim
  for (const match of text.matchAll(procRegex)) {
     procs.push(match[1].trim())
  }

  console.log(`\n=== ${path.basename(file)} ===`)
  console.log(`Visits found by Regex (${visits.length}):`, visits)
  console.log(`Procedures found by Regex (${procs.length}):`, procs)
}
