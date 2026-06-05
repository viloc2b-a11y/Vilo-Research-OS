import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local' })

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL_DIRECT or DATABASE_URL must be set')
}

const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

async function runSmokeTest() {
  console.log('Starting Deliverable Runtime Foundation Smoke Test...')

  // 1. Get a test organization and study from the seeded local database
  const orgRows = await sql`
    select id
    from organizations
    order by created_at asc
    limit 1
  `
  const org = orgRows[0]
  if (!org?.id) throw new Error('No organization found for testing')

  const studyRows = await sql`
    select id
    from studies
    where organization_id = ${org.id}
    order by created_at asc
    limit 1
  `
  const study = studyRows[0]
  if (!study?.id) throw new Error('No study found for testing')

  const userRows = await sql`
    select id
    from auth.users
    where id in (
      select user_id
      from organization_members
      where organization_id = ${org.id}
    )
    order by created_at asc
    limit 1
  `
  const userId = userRows[0]?.id || '00000000-0000-0000-0000-000000000000'

  // 2. Load CRA Monitoring Workbook Definition rules
  const systemCode = 'cra_monitoring_workbook'
  const audience = 'cra'
  
  // Note: we're using the DB tables directly here to simulate what create-deliverable-run does,
  // but we can't easily call the Next.js server actions from a TS node script without a lot of mocking.

  // Check definition
  console.log(`Checking definition for ${systemCode}...`)
  const definitionRows = await sql`
    select id
    from deliverable_definitions
    where organization_id = ${org.id}
      and system_code = ${systemCode}
    limit 1
  `
  let definition = definitionRows[0]

  if (!definition?.id) {
    console.log(`Definition not found, creating...`)
    const newDefRows = await sql`
      insert into deliverable_definitions (
        organization_id,
        system_code,
        name,
        target_audience,
        allowed_formats,
        scope_model,
        evidence_rules
      ) values (
        ${org.id},
        ${systemCode},
        ${'CRA Monitoring Workbook'},
        ${sql.json(['cra', 'sponsor'])},
        ${sql.json(['xlsx'])},
        ${'study'},
        ${sql.json({
          includedTypes: ['clinical_fields'],
          excludedTypes: ['internal_intel'],
          versionLogic: 'VERSION_USED_DURING_EXECUTION',
        })}
      )
      returning id
    `
    definition = newDefRows[0]
  }

  // 3. Create Deliverable Run
  console.log(`Creating Deliverable Run...`)
  const runRows = await sql`
    insert into deliverable_runs (
      organization_id,
      definition_id,
      run_status,
      run_by
    ) values (
      ${org.id},
      ${definition.id},
      ${'pending'},
      ${userId}
    )
    returning id
  `
  const run = runRows[0]

  // 4. Create Run Filters
  console.log(`Applying Filters (Scope: Study, Audience: CRA, Logic: VERSION_USED_DURING_EXECUTION)...`)
  await sql`
    insert into deliverable_run_filters (
      run_id,
      study_id,
      options
    ) values (
      ${run.id},
      ${study.id},
      ${sql.json({ audience, versionLogic: 'VERSION_USED_DURING_EXECUTION' })}
    )
  `

  // 5. Generate Audit Event
  console.log(`Generating Audit Event...`)
  await sql`
    insert into deliverable_audit_events (
      run_id,
      action,
      actor_id,
      metadata
    ) values (
      ${run.id},
      ${'run_created'},
      ${userId},
      ${sql.json({ systemCode, audience })}
    )
  `

  console.log(`\n✅ Smoke Test Passed!`)
  console.log(`Created Run ID: ${run.id}`)
  console.log(`Persistence verified for: definition, run, filters, and audit.`)
  console.log(`No PDFs or Excels were generated (as requested).`)
  await sql.end()
}

runSmokeTest().catch(async (error) => {
  console.error(error)
  await sql.end().catch(() => {})
  process.exitCode = 1
})
