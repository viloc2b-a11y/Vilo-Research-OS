export function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export function formOptionalText(formData: FormData, key: string): string | null {
  const value = formText(formData, key)
  return value ? value : null
}

export function formOptionalNumber(formData: FormData, key: string): number | null {
  const value = formText(formData, key)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formOptionalDateTime(formData: FormData, key: string): string | null {
  const value = formText(formData, key)
  return value ? value : null
}

export function oneParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
