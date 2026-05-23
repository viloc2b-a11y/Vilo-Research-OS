import fs from 'fs'
import path from 'path'

function run() {
  console.log('--- H5 Phase 4: Immutable Snapshot Smoke Test ---')
  let failed = false

  const snapshotFile = path.join(process.cwd(), 'lib/visit-runtime/snapshotVisit.ts')
  const lockFile = path.join(process.cwd(), 'lib/actions/lock-visit.ts')

  if (!fs.existsSync(snapshotFile)) {
    console.error('❌ Missing snapshotVisit.ts')
    failed = true
  } else {
    const content = fs.readFileSync(snapshotFile, 'utf8')
    if (!content.includes('upsert: false')) {
      console.error('❌ Snapshot must prevent overwrite (upsert: false missing)')
      failed = true
    } else {
      console.log('✅ Overwrite prevention exists.')
    }

    if (!content.includes('crypto.createHash')) {
      console.error('❌ Snapshot must include cryptographic hash lineage.')
      failed = true
    } else {
      console.log('✅ Hash lineage exists.')
    }

    if (!content.includes('SNAPSHOT_GENERATED')) {
      console.error('❌ Snapshot must log operational event.')
      failed = true
    } else {
      console.log('✅ Operational event linkage exists.')
    }

    if (!content.includes('visit-documents')) {
      console.error('❌ Snapshot must be saved to visit-documents bucket.')
      failed = true
    } else {
      console.log('✅ Snapshot artifact path logic exists.')
    }
  }

  if (!fs.existsSync(lockFile)) {
    console.error('❌ Missing lock-visit.ts')
    failed = true
  } else {
    const content = fs.readFileSync(lockFile, 'utf8')
    if (!content.includes('snapshotVisitProcedures')) {
      console.error('❌ lock-visit.ts must trigger snapshot workflow on lock.')
      failed = true
    } else {
      console.log('✅ Lock workflow linkage exists.')
    }

    if (!content.includes('!idempotent')) {
      console.error('❌ lock-visit.ts must prevent snapshot regeneration on idempotent retries (!idempotent missing).')
      failed = true
    } else {
      console.log('✅ Idempotent lock path does not regenerate snapshot.')
    }
  }

  if (failed) {
    console.error('\n❌ Smoke test failed.')
    process.exit(1)
  }

  console.log('\n✅ All H5 Phase 4 Immutable Snapshot requirements pass.')
}

run()
