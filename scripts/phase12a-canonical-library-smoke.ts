/**
 * Phase 12A — canonical clinical library smoke tests.
 * Run: npx tsx scripts/phase12a-canonical-library-smoke.ts
 */
import {
  loadCanonicalClinicalLibraryDocument,
  reportCanonicalFieldKeyCollisions,
  runCanonicalClinicalLibrarySmokeTests,
} from '@/lib/source-engine/canonical-clinical-library'

const results = runCanonicalClinicalLibrarySmokeTests()
const collisions = reportCanonicalFieldKeyCollisions()
const doc = loadCanonicalClinicalLibraryDocument()

const failed = results.filter((r) => !r.pass)
console.log(
  JSON.stringify(
    {
      phase: '12A-canonical-library-smoke',
      library_version: doc.library_version,
      core_libraries: Object.keys(doc.libraries),
      overlay_libraries: Object.keys(doc.overlays),
      results,
      collisions,
      summary: {
        passed: results.filter((r) => r.pass).length,
        failed: failed.length,
      },
    },
    null,
    2,
  ),
)

process.exit(failed.length > 0 ? 1 : 0)
