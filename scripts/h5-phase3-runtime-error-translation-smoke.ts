import { mapRuntimeDbErrorToCoordinatorMessage } from '../lib/concurrency/db-errors'

function run() {
  console.log('--- H5 Phase 3: Runtime DB Error Translation Smoke Test ---')
  let failed = false

  const tests = [
    {
      name: 'Stale Write',
      input: 'The record was updated elsewhere. STALE_WRITE.',
      expectedIncludes: 'Data changed on the server since this form was loaded',
    },
    {
      name: 'Terminal Visit State',
      input: 'visit_status locked is terminal and cannot be changed',
      expectedIncludes: 'locked or terminal (locked) state',
    },
    {
      name: 'Delete Blocked (Visits)',
      input: 'cannot delete from visits because delete_guard triggered',
      expectedIncludes: 'active visits exist and must be cancelled instead',
    },
    {
      name: 'Delete Blocked (Executions)',
      input: 'cannot delete from procedure_executions',
      expectedIncludes: 'procedure is no longer pending',
    },
    {
      name: 'Delete Blocked (Source)',
      input: 'cannot delete from source_responses',
      expectedIncludes: 'source responses have been submitted',
    },
    {
      name: 'Immutable Event',
      input: 'operational events are strictly append-only',
      expectedIncludes: 'Audit events are immutable',
    },
    {
      name: 'Unblinded Access',
      input: 'unblinded access required',
      expectedIncludes: 'unblinded access',
    },
    {
      name: 'Generic Error Preserved',
      input: 'Something went wrong',
      expectedIncludes: 'Something went wrong',
    },
  ]

  for (const t of tests) {
    const result = mapRuntimeDbErrorToCoordinatorMessage(t.input, t.input)
    if (!result.includes(t.expectedIncludes)) {
      console.error(`❌ Test failed: ${t.name}`)
      console.error(`   Expected to include: "${t.expectedIncludes}"`)
      console.error(`   Got: "${result}"`)
      failed = true
    } else {
      console.log(`✅ ${t.name} maps correctly.`)
    }
  }

  if (failed) {
    console.error('\n❌ Smoke test failed.')
    process.exit(1)
  }

  console.log('\n✅ All H5 Phase 3 DB error translation guards pass.')
}

run()
