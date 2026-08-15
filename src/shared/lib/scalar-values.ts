/**
 * Convert a scalar value (string, number, boolean) to a string for input fields.
 */
export function toScalarInputValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return value ? 'true' : 'false'
}

/**
 * Parse a raw input string into a scalar value (string, number, or boolean).
 * - 'true'/'false' (case-insensitive) become booleans
 * - Numeric strings become numbers
 * - Everything else remains a string
 */
export function parseScalarInput(rawValue: string): string | number | boolean {
  const trimmed = rawValue.trim()
  if (trimmed.toLowerCase() === 'true') {
    return true
  }
  if (trimmed.toLowerCase() === 'false') {
    return false
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const asNumber = Number(trimmed)
    if (!Number.isNaN(asNumber)) {
      return asNumber
    }
  }

  return rawValue
}
