export const DASHBOARD_TEST_DATA_PATTERNS = [
  /VPI-STAGING/i,
  /PHASE9A-PILOT/i,
  /VPI seed/i,
  /QA RBAC/i,
  /Reader Closure/i,
  /E2E Upload/i,
  /MV_E2E/i,
  /GEN_A001/i,
  /GEN_A002/i,
  /GEN_ONC/i,
  /GEN_VAC/i,
  /Operational Calendar Manual Event/i,
]

const DASHBOARD_TEST_SOURCE_SET_IDS = new Set([
  '3cea3f80',
  'f0ed64b5',
  '21533aa7',
  '59f7a569',
  '31152a92',
])

const TEST_CREATED_SOURCES = new Set(['test_seed', 'e2e_demo'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isDashboardTestDataText(value: unknown): boolean {
  if (value == null) return false
  const text = String(value)
  return DASHBOARD_TEST_DATA_PATTERNS.some((pattern) => pattern.test(text))
}

export function isDashboardTestSourceSetId(value: unknown): boolean {
  if (value == null) return false
  const text = String(value)
  return Array.from(DASHBOARD_TEST_SOURCE_SET_IDS).some((prefix) => text.startsWith(prefix))
}

export function hasDashboardTestDataMarker(value: unknown): boolean {
  if (value == null) return false

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return isDashboardTestDataText(value)
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasDashboardTestDataMarker(item))
  }

  if (!isPlainObject(value)) return false

  const createdSource = value.created_source
  if (typeof createdSource === 'string' && TEST_CREATED_SOURCES.has(createdSource)) return true

  const metadata = value.metadata
  if (isPlainObject(metadata)) {
    if (metadata.is_test_data === true || metadata.created_by_system === true) return true
    if (isDashboardTestDataText(metadata.seed_source) || isDashboardTestDataText(metadata.provenance)) return true
  }

  return Object.entries(value).some(([key, nested]) => {
    if (key === 'id' || key.endsWith('_id') || key === 'organization_id' || key === 'created_by' || key === 'actor_user_id') {
      return isDashboardTestSourceSetId(nested)
    }
    return hasDashboardTestDataMarker(nested)
  })
}

export function filterDashboardTestDataRows<T>(rows: T[]): T[] {
  return rows.filter((row) => !hasDashboardTestDataMarker(row))
}
