import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const checks = [
  {
    file: 'lib/ops/command-center-read-model.ts',
    patterns: [
      '.in(\'organization_id\', organizationIds)',
      '.in(\'response_set_id\', scopedResponseSetIds)',
    ],
  },
  {
    file: 'lib/ops/workspace-read-model.ts',
    patterns: [
      'getOrganizationMemberships',
      '.eq(\'organization_id\', organizationId)',
      '.in(\'response_set_id\', sourceSetIds)',
    ],
  },
  {
    file: 'app/(ops)/studies/[studyId]/page.tsx',
    patterns: [
      'getOrganizationMemberships',
      '.select(\'id, organization_id, name, slug, status\')',
      '.eq(\'organization_id\', organizationId)',
    ],
  },
  {
    file: 'app/(ops)/subjects/[subjectId]/page.tsx',
    patterns: [
      'getOrganizationMemberships',
      'const organizationId = subject.organization_id as string',
      'canAccessOrganization',
    ],
  },
  {
    file: 'app/(ops)/visits/[visitId]/page.tsx',
    patterns: [
      'getOrganizationMemberships',
      '.eq(\'organization_id\', organizationId)',
      'const subjectPath    = `/studies/${visit.study_id}/subjects/${visit.study_subject_id}`',
    ],
  },
  {
    file: 'lib/api/source/auth.ts',
    patterns: [
      'requireOrganizationMember',
      'getOrganizationMemberships',
      'User is not a member of the requested organization',
    ],
  },
]

const failures = []

for (const check of checks) {
  const absolute = path.join(root, check.file)
  if (!fs.existsSync(absolute)) {
    failures.push(`${check.file}: missing file`)
    continue
  }

  const text = fs.readFileSync(absolute, 'utf8')
  for (const pattern of check.patterns) {
    if (!text.includes(pattern)) {
      failures.push(`${check.file}: missing pattern ${JSON.stringify(pattern)}`)
    }
  }
}

if (failures.length > 0) {
  console.error('Multi-tenant isolation validation failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Multi-tenant isolation validation passed.')
