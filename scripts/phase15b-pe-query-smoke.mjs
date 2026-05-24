import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const visitId = '6690da63-4bf1-4681-815a-3e39b7b014bc'
const r = await s
  .from('procedure_executions')
  .select('id, visit_id, source_definition_version_id')
  .eq('visit_id', visitId)
console.log(JSON.stringify(r, null, 2))
