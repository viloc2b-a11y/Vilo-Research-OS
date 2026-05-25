/**
 * Seed fixtures/intake-review/para-oa-012 from Phase 12C-PY intake output.
 * Run: node scripts/seed-phase12d-fixture.mjs
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureDir = join(root, 'fixtures/protocol-intake')
const smokeIn = join(root, '.tmp-phase12d-seed-in')
const out = join(root, 'fixtures/intake-review/para-oa-012')

if (existsSync(smokeIn)) rmSync(smokeIn, { recursive: true })
mkdirSync(smokeIn, { recursive: true })
for (const name of ['para-oa-012-protocol-excerpt.txt', 'para-oa-012-schedule.csv']) {
  cpSync(join(fixtureDir, name), join(smokeIn, name))
}

const py = spawnSync(
  process.platform === 'win32' ? 'python' : 'python3',
  [
    join(root, 'scripts/phase_12c_protocol_intake.py'),
    '--input',
    smokeIn,
    '--study-key',
    'STUDY-KOA-001',
    '--output',
    join(root, '.tmp-phase12d-seed'),
    '--force',
  ],
  { cwd: root, encoding: 'utf8' },
)

if (py.status !== 0) {
  console.error(py.stderr || py.stdout)
  process.exit(py.status ?? 1)
}

const tmp = join(root, '.tmp-phase12d-seed')
if (existsSync(out)) rmSync(out, { recursive: true })
mkdirSync(join(root, 'fixtures/intake-review'), { recursive: true })
cpSync(tmp, out, { recursive: true })
rmSync(tmp, { recursive: true })
console.log(JSON.stringify({ ok: true, out }, null, 2))
