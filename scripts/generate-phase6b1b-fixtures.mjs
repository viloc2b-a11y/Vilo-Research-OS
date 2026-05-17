/**
 * Write bulk pathology/medication fixture JSON from scripts/lib/patient-library-bulk-data.mjs
 * Usage: node scripts/generate-phase6b1b-fixtures.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildMedicationTerms,
  buildPathologyTerms,
  buildSuggestedLinks,
} from './lib/patient-library-bulk-data.mjs'
import { projectRoot } from './lib/env.mjs'

const pathologyTerms = buildPathologyTerms()
const medications = buildMedicationTerms()
const links = buildSuggestedLinks()

const pathologyOut = {
  catalog_version: '1.1.0',
  catalog_id: 'vilo-pathology-medical-history-lookup-bulk',
  description: 'Bulk coordinator quick-pick pathology catalog (Phase 6B.1B).',
  term_count: pathologyTerms.length,
  terms: pathologyTerms,
}

const medicationOut = {
  catalog_version: '1.1.0',
  catalog_id: 'vilo-medication-conmed-lookup-bulk',
  description: 'Bulk coordinator quick-pick medication catalog (Phase 6B.1B).',
  medication_count: medications.length,
  medications,
  suggested_links: links,
}

const linksOut = {
  catalog_version: '1.1.0',
  link_count: links.length,
  links,
}

const dir = resolve(projectRoot, 'fixtures/pathology')
writeFileSync(resolve(dir, 'pathology-catalog-bulk.v1.json'), JSON.stringify(pathologyOut, null, 2), 'utf8')
writeFileSync(resolve(dir, 'medication-library-bulk.v1.json'), JSON.stringify(medicationOut, null, 2), 'utf8')
writeFileSync(
  resolve(dir, 'pathology-medication-links-bulk.v1.json'),
  JSON.stringify(linksOut, null, 2),
  'utf8',
)

console.log(
  `Wrote bulk fixtures: pathology=${pathologyTerms.length} medications=${medications.length} links=${links.length}`,
)
