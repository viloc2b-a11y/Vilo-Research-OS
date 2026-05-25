/**
 * Deploy Vilo OS to Cloudflare Pages (git-connected production).
 *
 * Default flow:
 *   1. npm run build (preflight)
 *   2. git push origin <branch>  → triggers Cloudflare Pages build for os.viloresearchgroup.com
 *
 * Env (optional, .env.local):
 *   DEPLOY_GIT_REMOTE=origin
 *   DEPLOY_GIT_BRANCH=           # empty = current branch
 *   DEPLOY_SKIP_BUILD=1          # skip when CI already built
 *   DEPLOY_SKIP_PUSH=1           # build only
 *
 * Usage:
 *   npm run deploy
 *   npm run deploy -- --skip-build
 *   npm run deploy -- --skip-push
 */
import { spawnSync } from 'node:child_process'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (exit ${result.status ?? 'unknown'})`)
  }
}

function currentGitBranch() {
  const result = spawnSync('git', ['branch', '--show-current'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error('Could not determine current git branch')
  }
  return (result.stdout || '').trim()
}

function gitStatusPorcelain() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error('git status failed')
  }
  return (result.stdout || '').trim()
}

function parseArgs(argv) {
  return {
    skipBuild: argv.includes('--skip-build') || process.env.DEPLOY_SKIP_BUILD === '1',
    skipPush: argv.includes('--skip-push') || process.env.DEPLOY_SKIP_PUSH === '1',
  }
}

async function main() {
  loadEnvFiles()
  const { skipBuild, skipPush } = parseArgs(process.argv.slice(2))

  const remote = process.env.DEPLOY_GIT_REMOTE?.trim() || 'origin'
  const branch = process.env.DEPLOY_GIT_BRANCH?.trim() || currentGitBranch()

  if (!branch) {
    throw new Error('Detached HEAD — checkout a branch before deploy')
  }

  const dirty = gitStatusPorcelain()
  if (dirty) {
    console.error('\nDeploy blocked: uncommitted changes present.')
    console.error('Commit or stash first, then run npm run deploy again.\n')
    console.error(dirty)
    process.exit(1)
  }

  console.log(`\nVilo OS deploy → Cloudflare Pages (git: ${remote}/${branch})\n`)
  if (branch !== 'main' && branch !== 'master') {
    console.warn(
      `Warning: production (os.viloresearchgroup.com) typically builds from "main".\n` +
        `You are pushing "${branch}" — calendar/UI changes will not appear until that branch is merged to main\n` +
        `or set as the Cloudflare Pages production branch.\n`,
    )
  }

  if (!skipBuild) {
    console.log('Step 1/2: production build preflight…')
    run('npm', ['run', 'build'])
  } else {
    console.log('Step 1/2: build skipped (--skip-build / DEPLOY_SKIP_BUILD)')
  }

  if (!skipPush) {
    console.log(`\nStep 2/2: git push ${remote} ${branch}…`)
    run('git', ['push', '-u', remote, branch])
  } else {
    console.log('\nStep 2/2: git push skipped (--skip-push / DEPLOY_SKIP_PUSH)')
  }

  console.log(`
Deploy requested.

Cloudflare Pages (connected repo) should start a new build for branch "${branch}".
Production URL: https://os.viloresearchgroup.com

After the Pages build finishes:
  - Smoke: E2E_BASE_URL=https://os.viloresearchgroup.com node scripts/phase16h-coordinator-operational-usability-smoke.mjs
  - DB:    npm run db:migrate  (or --from <migration>.sql for single files)

Dashboard: Cloudflare → Workers & Pages → your Vilo OS project → Deployments
`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
