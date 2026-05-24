/**
 * Phase 15C — diagnose coordinator capture RBAC + study scope.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'
import postgres from 'postgres'

loadEnvFiles()

const ORG = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const STUDY = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const PILOT_ACTOR = 'd7e43ee5-5c08-489b-b293-8ef288e7fdb7'
const CALENDAR_EMAIL = 'calendar.qa.coordinator@vilo-os.staging'
const RC_EMAIL = 'rbac.qa.research_coordinator@vilo-os.staging'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: dbUrl.includes('pooler') ? false : undefined })

const users = await sql`
  select id, email from auth.users
  where email in (${CALENDAR_EMAIL}, ${RC_EMAIL})
`
const mems = await sql`
  select om.user_id, u.email, om.role, om.roles, om.status
  from organization_members om
  join auth.users u on u.id = om.user_id
  where om.organization_id = ${ORG}::uuid
    and u.email in (${CALENDAR_EMAIL}, ${RC_EMAIL})`

const studyMembers = await sql`
  select sm.user_id, u.email, sm.role
  from study_members sm
  join auth.users u on u.id = sm.user_id
  where sm.study_id = ${STUDY}::uuid
    and u.email in (${CALENDAR_EMAIL}, ${RC_EMAIL})`

const pilotMem = await sql`
  select role, roles, status from organization_members
  where organization_id = ${ORG}::uuid and user_id = ${PILOT_ACTOR}::uuid`

console.log(JSON.stringify({ users, mems, studyMembers, pilotMem }, null, 2))
await sql.end()
