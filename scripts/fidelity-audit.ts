import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const tests = [
  { id: 'PARA_OA_012', studyId: null, file: 'fixtures/protocol-intake/para-oa-012-protocol-excerpt.txt' },
  { id: 'MV40618', studyId: null, file: 'fixtures/protocol-intake/mv40618-protocol-excerpt.txt' },
  { id: 'PROTOCOL_A001', studyId: '60e72d79-6c7f-4c9f-9458-02ecd496b564', file: 'validation-corpus/sanitized/protocols/PROTOCOL_A001.txt' },
  { id: 'PROTOCOL_A002', studyId: '1d7743d9-1993-4c7a-a27d-319093a870db', file: 'validation-corpus/sanitized/protocols/PROTOCOL_A002.txt' },
  { id: 'VACCINE_001', studyId: '86cbc387-1bd3-40ae-a180-0769da76d0d7', file: 'fixtures/protocol-intake/demo-vaccine-protocol.txt' },
  { id: 'ONC_882', studyId: '0c938da1-60fb-4065-81fe-b95e4e68b4ff', file: 'fixtures/protocol-intake/demo-oncology-protocol.txt' }
]

async function run() {
  for (const test of tests) {
    console.log(`\n======================================================`)
    console.log(`PROTOCOL: ${test.id}`)
    console.log(`======================================================`)
    
    // Read source
    try {
      const text = fs.readFileSync(path.join(__dirname, '..', test.file), 'utf8')
      const scheduleText = text.split(/Schedule of Events/i)[1]?.split(/End of/i)[0] || text
      console.log(`\n--- SOURCE TEXT (Excerpt) ---`)
      console.log(scheduleText.substring(0, 1500) + '...')
    } catch(err: any) {
      console.log(`Error reading ${test.file}: ${err.message}`)
    }

    // Get the latest study for this protocol
    let studyId = test.studyId
    if (!studyId) {
      const { data: rtStudies } = await supabase.from('protocol_runtime_studies').select('study_id, id').eq('protocol_number', test.id).order('created_at', { ascending: false }).limit(1)
      if (!rtStudies || rtStudies.length === 0) {
        console.log(`No runtime study found for ${test.id}`)
        continue
      }
      studyId = rtStudies[0].study_id
    }
    
    console.log(`\n--- RUNTIME VISITS ---`)
    const { data: rtVisits } = await supabase.from('study_runtime_visits').select('visit_name, study_day, sequence_order').eq('study_id', studyId).order('sequence_order')
    rtVisits?.forEach(v => console.log(`- ${v.visit_name} (Day ${v.study_day})`))

    console.log(`\n--- SOURCE PACKAGE FORMS ---`)
    const { data: pkgs } = await supabase.from('study_source_packages').select('id').eq('study_id', studyId).order('created_at', { ascending: false }).limit(1)
    if (pkgs && pkgs.length > 0) {
      const { data: forms } = await supabase.from('runtime_source_visit_shells').select('visit_name').eq('source_package_id', pkgs[0].id)
      forms?.forEach(f => console.log(`- ${f.visit_name}`))
    }
  }
}

run()
