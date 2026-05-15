/**
 * Create synthetic staging users + two organizations (service role).
 * Usage: npm run db:provision
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'

const SYNTHETIC = {
  orgA: { name: 'Synthetic Site Alpha (Staging)' },
  orgB: { name: 'Synthetic Site Beta (Staging)' },
  userA: {
    email: 'synthetic.staff.a@vilo-os.staging',
    password: 'SyntheticViloOs!2026A',
    displayName: 'Synthetic Staff A',
    role: 'admin',
  },
  userB: {
    email: 'synthetic.staff.b@vilo-os.staging',
    password: 'SyntheticViloOs!2026B',
    displayName: 'Synthetic Staff B',
    role: 'admin',
  },
}

async function ensureUser(admin, spec) {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 })
  const existing = listed?.users?.find((u) => u.email === spec.email)
  if (existing) {
    console.log(`  User exists: ${spec.email} (${existing.id})`)
    return existing
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: { display_name: spec.displayName },
  })
  if (error) throw new Error(`createUser ${spec.email}: ${error.message}`)
  console.log(`  Created user: ${spec.email} (${data.user.id})`)
  return data.user
}

async function main() {
  requireEnv([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])
  loadEnvFiles()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log('Creating synthetic auth users...')
  const userA = await ensureUser(admin, SYNTHETIC.userA)
  const userB = await ensureUser(admin, SYNTHETIC.userB)

  async function ensureOrg(name) {
    const { data: existing } = await admin
      .from('organizations')
      .select('id, name')
      .eq('name', name)
      .maybeSingle()
    if (existing) {
      console.log(`  Organization exists: ${name} (${existing.id})`)
      return existing
    }
    const { data, error } = await admin
      .from('organizations')
      .insert({ name })
      .select('id, name')
      .single()
    if (error) throw new Error(`organization ${name}: ${error.message}`)
    console.log(`  Organization created: ${name} (${data.id})`)
    return data
  }

  console.log('Creating organizations...')
  const orgA = await ensureOrg(SYNTHETIC.orgA.name)
  const orgB = await ensureOrg(SYNTHETIC.orgB.name)

  console.log(`  Org A: ${orgA.name} (${orgA.id})`)
  console.log(`  Org B: ${orgB.name} (${orgB.id})`)

  for (const [user, org, spec] of [
    [userA, orgA, SYNTHETIC.userA],
    [userB, orgB, SYNTHETIC.userB],
  ]) {
    await admin.from('profiles').upsert({
      id: user.id,
      display_name: spec.displayName,
    })
    const { error: memErr } = await admin.from('organization_members').upsert(
      {
        organization_id: org.id,
        user_id: user.id,
        role: spec.role,
      },
      { onConflict: 'organization_id,user_id' },
    )
    if (memErr) throw new Error(`membership ${spec.email}: ${memErr.message}`)
    console.log(`  Membership: ${spec.email} → ${org.name} (${spec.role})`)
  }

  console.log('\n--- Synthetic seed summary (save for validation) ---')
  console.log(JSON.stringify({ orgA, orgB, userA: { id: userA.id, email: SYNTHETIC.userA.email }, userB: { id: userB.id, email: SYNTHETIC.userB.email } }, null, 2))
  console.log('\nPasswords are in scripts/provision-synthetic.mjs (staging only).')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
