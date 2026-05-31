import * as fs from 'fs'
import { extractProtocolSectionsFromText } from '../lib/protocol-intake-runtime/extract-protocol-sections'
import { extractVisitCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-visit-candidates'
import { extractProcedureCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-procedure-candidates'

const text = fs.readFileSync('fixtures/protocol-intake/demo-oncology-protocol.txt', 'utf8')
const sections = extractProtocolSectionsFromText(text)
const sectionsWithIds = sections.map((s, i) => ({ 
  id: `sec-${i}`, 
  protocolVersionId: '123',
  sectionType: s.section_type,
  extractedText: s.extracted_text,
  sectionCode: s.section_code,
  sectionTitle: s.section_title
}))

const visits = extractVisitCandidatesFromSections(sectionsWithIds)
console.log("Visits extracted:", visits.length)
for (const v of visits) {
  console.log(v.visit_name)
}

