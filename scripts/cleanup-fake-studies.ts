import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !key) {
  throw new Error('Missing Supabase env vars')
}

const supabase = createClient(supabaseUrl, key)

async function main() {
  const { data: studies, error } = await supabase
    .from('studies')
    .select(`
      id,
      name,
      slug,
      status,
      created_at,
      organization_id,
      organizations ( name )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch studies:', error.message)
    process.exit(1)
  }

  const suspicious: any[] = []

  for (const study of studies || []) {
    const isFakeName = /smoke|test|demo|synthetic|qa|mock/i.test(study.name) || /smoke|test|demo|synthetic|qa|mock/i.test(study.slug || '')
    const isRecent = new Date(study.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
    
    // Check if it has a real protocol version
    const { count: protocolCount } = await supabase
      .from('study_versions')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', study.id)

    if (isFakeName || (!protocolCount && isRecent)) {
      suspicious.push({
        id: study.id,
        name: study.name,
        slug: study.slug,
        orgName: study.organizations?.name || 'Unknown',
        reason: isFakeName ? 'Fake/Test name' : 'No protocol versions + recent',
      })
    }
  }

  console.log('=== SUSPICIOUS STUDIES AUDIT REPORT ===')
  console.log(`Found ${suspicious.length} suspicious studies out of ${studies?.length || 0} total.\n`)
  
  if (suspicious.length > 0) {
    console.log('-- SQL TO DELETE/ARCHIVE SUSPICIOUS STUDIES --')
    console.log('/* REVIEW BEFORE EXECUTION */\n')
    
    suspicious.forEach(s => {
      console.log(`-- Study: ${s.name} (${s.slug}) | Org: ${s.orgName} | Reason: ${s.reason}`)
      console.log(`-- DELETE FROM public.studies WHERE id = '${s.id}';`)
      console.log(`UPDATE public.studies SET status = 'archived' WHERE id = '${s.id}';\n`)
    })
  } else {
    console.log('No suspicious studies found.')
  }
}

main().catch(console.error)
