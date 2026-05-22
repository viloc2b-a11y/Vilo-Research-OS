/**
 * Resolve published capture field options (list_code → selectable values).
 */

const CODED_LIST_OPTIONS: Record<string, string[]> = {
  EPRO_STATUS: ['completed', 'partial', 'not_done', 'not_applicable'],
  AE_REL: ['related', 'possibly_related', 'not_related', 'unknown'],
  AE_SEVERITY: ['mild', 'moderate', 'severe'],
  AE_SERIOUSNESS: ['serious', 'non_serious'],
  IP_ROUTE: ['oral', 'iv', 'im', 'sc', 'other'],
}

export function parseCaptureFieldOptions(options: unknown): string[] {
  if (!options) return []
  if (Array.isArray(options)) {
    return options.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        if (typeof row.value === 'string') return row.value
        if (typeof row.label === 'string') return row.label
      }
      return JSON.stringify(item)
    })
  }
  if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
    const row = options as Record<string, unknown>
    const listCode =
      typeof row.list_code === 'string'
        ? row.list_code
        : typeof row.option_list_code === 'string'
          ? row.option_list_code
          : null
    if (listCode && CODED_LIST_OPTIONS[listCode]) {
      return CODED_LIST_OPTIONS[listCode]
    }
  }
  return []
}
