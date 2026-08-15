/**
 * Throwing type guards for test assertions after expect().toBeDefined().
 */

export function requireDefined<T>(
  value: T | undefined | null,
  context: string,
): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected defined value: ${context}`)
  }
  return value
}

export function requireFirst<T>(items: readonly T[], context: string): T {
  const first = items[0]
  if (first === undefined) {
    throw new Error(`Expected non-empty array: ${context}`)
  }
  return first
}
