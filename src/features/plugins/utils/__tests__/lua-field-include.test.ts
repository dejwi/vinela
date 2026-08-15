import { describe, expect, it } from 'vitest'
import type { PluginConfigValue, SchemaLuaOption } from '@/shared/types'
import { decideLuaInclusion, isLuaFieldIncluded } from '../lua-field-include'

function createLuaOption(
  defaultValue?: string,
  defaultEmission?: SchemaLuaOption['defaultEmission'],
): SchemaLuaOption {
  return {
    key: 'handler',
    label: 'Handler',
    type: 'lua',
    ...(defaultValue !== undefined && { default: defaultValue }),
    ...(defaultEmission !== undefined && { defaultEmission }),
  }
}

interface DecisionCase {
  readonly name: string
  readonly defaultValue?: string
  readonly defaultEmission?: SchemaLuaOption['defaultEmission']
  readonly value: PluginConfigValue | undefined
  readonly explicitOverride: boolean | undefined
  readonly expectedIncluded: boolean
  readonly expectedReason:
    | 'explicit-override'
    | 'user-cleared'
    | 'undefined-value'
    | 'matches-default'
    | 'differs-from-default'
    | 'no-default-non-empty'
    | 'no-default-empty'
  readonly expectedContradiction: boolean
}

const cases: readonly DecisionCase[] = [
  {
    name: 'undefined value without override uses undefined-value reason',
    defaultValue: 'function() end',
    value: undefined,
    explicitOverride: undefined,
    expectedIncluded: false,
    expectedReason: 'undefined-value',
    expectedContradiction: false,
  },
  {
    name: 'empty string is user-cleared without override',
    defaultValue: '{}',
    value: '',
    explicitOverride: undefined,
    expectedIncluded: false,
    expectedReason: 'user-cleared',
    expectedContradiction: false,
  },
  {
    name: 'empty string with explicit false remains omitted',
    defaultValue: '{}',
    value: '',
    explicitOverride: false,
    expectedIncluded: false,
    expectedReason: 'user-cleared',
    expectedContradiction: false,
  },
  {
    name: 'empty string with explicit true is contradiction but omitted',
    defaultValue: '{}',
    value: '',
    explicitOverride: true,
    expectedIncluded: false,
    expectedReason: 'user-cleared',
    expectedContradiction: true,
  },
  {
    name: 'value matching default is omitted',
    defaultValue: 'function() return nil end',
    value: 'function() return nil end',
    explicitOverride: undefined,
    expectedIncluded: false,
    expectedReason: 'matches-default',
    expectedContradiction: false,
  },
  {
    name: 'explicit-only default emits when stored value matches schema default',
    defaultValue: 'function() return nil end',
    defaultEmission: 'explicit-only',
    value: 'function() return nil end',
    explicitOverride: undefined,
    expectedIncluded: true,
    expectedReason: 'no-default-non-empty',
    expectedContradiction: false,
  },
  {
    name: 'explicit-only default still omits undefined value',
    defaultValue: 'function() return nil end',
    defaultEmission: 'explicit-only',
    value: undefined,
    explicitOverride: undefined,
    expectedIncluded: false,
    expectedReason: 'undefined-value',
    expectedContradiction: false,
  },
  {
    name: 'value differing from default is included',
    defaultValue: 'function() return nil end',
    value: 'function() return true end',
    explicitOverride: undefined,
    expectedIncluded: true,
    expectedReason: 'differs-from-default',
    expectedContradiction: false,
  },
  {
    name: 'no default + whitespace string is omitted',
    value: '   ',
    explicitOverride: undefined,
    expectedIncluded: false,
    expectedReason: 'no-default-empty',
    expectedContradiction: false,
  },
  {
    name: 'no default + non-empty string is included',
    value: 'return true',
    explicitOverride: undefined,
    expectedIncluded: true,
    expectedReason: 'no-default-non-empty',
    expectedContradiction: false,
  },
  {
    name: 'non-string value is included as differs-from-default',
    defaultValue: 'function() end',
    value: { foo: 'bar' },
    explicitOverride: undefined,
    expectedIncluded: true,
    expectedReason: 'differs-from-default',
    expectedContradiction: false,
  },
  {
    name: 'explicit override true on undefined value includes',
    value: undefined,
    explicitOverride: true,
    expectedIncluded: true,
    expectedReason: 'explicit-override',
    expectedContradiction: true,
  },
  {
    name: 'explicit override false on changed value excludes',
    defaultValue: 'function() return nil end',
    value: 'function() return true end',
    explicitOverride: false,
    expectedIncluded: false,
    expectedReason: 'explicit-override',
    expectedContradiction: true,
  },
  {
    name: 'explicit override false agreeing with smart default has no contradiction',
    defaultValue: 'function() return nil end',
    value: 'function() return nil end',
    explicitOverride: false,
    expectedIncluded: false,
    expectedReason: 'explicit-override',
    expectedContradiction: false,
  },
  {
    name: 'explicit override true agreeing with smart default has no contradiction',
    defaultValue: 'function() return nil end',
    value: 'function() return true end',
    explicitOverride: true,
    expectedIncluded: true,
    expectedReason: 'explicit-override',
    expectedContradiction: false,
  },
]

describe('decideLuaInclusion', () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const option = createLuaOption(
        testCase.defaultValue,
        testCase.defaultEmission,
      )
      const decision = decideLuaInclusion(
        option,
        testCase.value,
        testCase.explicitOverride,
      )

      expect(decision.included).toBe(testCase.expectedIncluded)
      expect(decision.reason).toBe(testCase.expectedReason)
      expect(decision.overrideContradiction).toBe(
        testCase.expectedContradiction,
      )
    })
  }
})

describe('isLuaFieldIncluded wrapper', () => {
  it('returns decideLuaInclusion().included', () => {
    const option = createLuaOption('function() return nil end')
    expect(isLuaFieldIncluded(option, '', true)).toBe(false)
    expect(isLuaFieldIncluded(option, 'function() return true end', true)).toBe(
      true,
    )
  })
})
