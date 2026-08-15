import type { PluginConfigValue, SchemaLuaOption } from '@/shared/types'

export type LuaInclusionReason =
  | 'explicit-override'
  | 'user-cleared'
  | 'undefined-value'
  | 'matches-default'
  | 'differs-from-default'
  | 'no-default-non-empty'
  | 'no-default-empty'

export interface LuaInclusionDecision {
  readonly included: boolean
  readonly reason: LuaInclusionReason
  readonly overrideContradiction: boolean
}

function getEmittedLuaDefault(option: SchemaLuaOption): string | undefined {
  if (option.defaultEmission === 'explicit-only') {
    return undefined
  }

  return option.default
}

function getSmartDefaultDecision(
  option: SchemaLuaOption,
  value: PluginConfigValue | undefined,
): LuaInclusionDecision {
  if (value === undefined) {
    return {
      included: false,
      reason: 'undefined-value',
      overrideContradiction: false,
    }
  }

  if (typeof value !== 'string') {
    return {
      included: true,
      reason: 'differs-from-default',
      overrideContradiction: false,
    }
  }

  const emittedDefault = getEmittedLuaDefault(option)

  if (emittedDefault === undefined) {
    if (value.trim().length > 0) {
      return {
        included: true,
        reason: 'no-default-non-empty',
        overrideContradiction: false,
      }
    }

    return {
      included: false,
      reason: 'no-default-empty',
      overrideContradiction: false,
    }
  }

  if (value === emittedDefault) {
    return {
      included: false,
      reason: 'matches-default',
      overrideContradiction: false,
    }
  }

  return {
    included: true,
    reason: 'differs-from-default',
    overrideContradiction: false,
  }
}

export function decideLuaInclusion(
  option: SchemaLuaOption,
  value: PluginConfigValue | undefined,
  explicitOverride: boolean | undefined,
): LuaInclusionDecision {
  if (value === '') {
    return {
      included: false,
      reason: 'user-cleared',
      overrideContradiction: explicitOverride === true,
    }
  }

  const smartDefaultDecision = getSmartDefaultDecision(option, value)

  if (explicitOverride !== undefined) {
    return {
      included: explicitOverride,
      reason: 'explicit-override',
      overrideContradiction: explicitOverride !== smartDefaultDecision.included,
    }
  }

  return smartDefaultDecision
}

/**
 * Determine whether a lua-type field should be included in generated Lua.
 *
 * Resolution order:
 * 1. Explicit user override (from luaFieldOverrides map) — always wins
 * 2. Smart default:
 *    - OFF if value is undefined
 *    - OFF if value matches the emitted schema default
 *    - ON if value differs from the emitted schema default
 *    - If schema has no emitted default: ON only when non-empty
 */
/** @deprecated Use decideLuaInclusion().included instead. */
export function isLuaFieldIncluded(
  option: SchemaLuaOption,
  value: PluginConfigValue | undefined,
  explicitOverride: boolean | undefined,
): boolean {
  return decideLuaInclusion(option, value, explicitOverride).included
}
