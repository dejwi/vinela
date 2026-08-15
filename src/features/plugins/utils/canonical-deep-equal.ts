import type { PluginConfigValue } from '@/shared/types'

function canonicalDeepEqualArrays(
  left: PluginConfigValue[],
  right: PluginConfigValue[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (!canonicalDeepEqual(left[index], right[index])) {
      return false
    }
  }
  return true
}

function canonicalDeepEqualObjects(
  left: Record<string, PluginConfigValue>,
  right: Record<string, PluginConfigValue>,
): boolean {
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) {
      return false
    }
  }
  for (const key of leftKeys) {
    if (!canonicalDeepEqual(left[key], right[key])) {
      return false
    }
  }
  return true
}

export function canonicalDeepEqual(
  a: PluginConfigValue | undefined,
  b: PluginConfigValue | undefined,
): boolean {
  if (a === b) {
    return true
  }
  if (a === undefined || b === undefined) {
    return false
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return false
    }
    return canonicalDeepEqualArrays(a, b)
  }

  if (typeof a === 'object' || typeof b === 'object') {
    if (
      typeof a !== 'object' ||
      a === null ||
      Array.isArray(a) ||
      typeof b !== 'object' ||
      b === null ||
      Array.isArray(b)
    ) {
      return false
    }
    return canonicalDeepEqualObjects(a, b)
  }

  return false
}
