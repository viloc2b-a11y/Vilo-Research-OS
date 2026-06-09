import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { Client } from 'pg'

loadEnv({ path: '.env.local' })
loadEnv()

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('Missing DATABASE_URL')

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  console.log('Cleaning up bad test rows...')
  await client.query(`delete from public.studies where created_source = 'test_seed'`)

  console.log('Replacing constraint...')
  await client.query(`
    alter table public.studies drop constraint if exists studies_prevent_prod_seed_check;
    alter table public.studies add constraint studies_prevent_prod_seed_check
    check (
      created_source in ('legacy', 'human_new_study')
      or coalesce(current_setting('app.allow_test_seed', true), 'false') = 'true'
    );
  `)
  console.log('Constraint replaced.')
  await client.end()
}
main().catch(console.error)
