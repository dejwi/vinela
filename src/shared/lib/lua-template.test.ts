import { describe, expect, it } from 'vitest'
import { requireDefined } from '@/features/lua-generator/__tests__/utils/test-assertions'
import type { RunFunctionParamSignature } from '@/shared/types'
import {
  analyzeTemplate,
  defaultToLua,
  groupDottedKeys,
  renderTemplate,
  validateTemplate,
} from './lua-template'

// ============================================
// analyzeTemplate
// ============================================

describe('analyzeTemplate', () => {
  it('detects positional mode for $params', () => {
    const result = analyzeTemplate('vim.fn.expand($params)')
    expect(result.mode).toBe('positional')
    expect(result.namedPlaceholders).toHaveLength(0)
  })

  it('detects named mode for $params.<name>', () => {
    const result = analyzeTemplate("require('x').foo($params.a, $params.b)")
    expect(result.mode).toBe('named')
    expect(result.namedPlaceholders).toEqual(['a', 'b'])
  })

  it('template with no placeholders defaults to positional', () => {
    const result = analyzeTemplate('vim.fn.getcwd()')
    expect(result.mode).toBe('positional')
    expect(result.namedPlaceholders).toHaveLength(0)
  })

  it('deduplicates named placeholders', () => {
    const result = analyzeTemplate('foo($params.x, $params.x)')
    expect(result.namedPlaceholders).toEqual(['x'])
  })

  it('preserves the raw template string', () => {
    const template = 'vim.fn.expand($params)'
    const result = analyzeTemplate(template)
    expect(result.template).toBe(template)
  })

  it('mixed mode defaults to positional (validation catches it)', () => {
    const result = analyzeTemplate('foo($params, $params.x)')
    expect(result.mode).toBe('positional')
  })
})

// ============================================
// validateTemplate
// ============================================

describe('validateTemplate', () => {
  const noParams: RunFunctionParamSignature[] = []

  const oneRequiredParam: RunFunctionParamSignature[] = [
    { name: 'expr', type: 'string', optional: false },
  ]

  const twoParams: RunFunctionParamSignature[] = [
    { name: 'a', type: 'string', optional: false },
    { name: 'b', type: 'string', optional: true },
  ]

  it('valid positional template returns valid: true', () => {
    const result = validateTemplate('vim.fn.expand($params)', oneRequiredParam)
    expect(result.valid).toBe(true)
  })

  it('valid named template returns valid: true', () => {
    const result = validateTemplate(
      "require('x').foo($params.a, $params.b)",
      twoParams,
    )
    expect(result.valid).toBe(true)
  })

  it('mixed mode returns valid: false with clear error', () => {
    const result = validateTemplate('foo($params, $params.x)', oneRequiredParam)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(
        result.issues.some((issue) => issue.code === 'MIXED_PLACEHOLDER_MODES'),
      ).toBe(true)
      expect(result.errors.some((e) => e.includes('mixes'))).toBe(true)
    }
  })

  it('named placeholder referencing undeclared param returns error', () => {
    const result = validateTemplate('foo($params.unknown)', oneRequiredParam)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('unknown'))).toBe(true)
    }
  })

  it('required param not referenced in named template returns error', () => {
    const result = validateTemplate('foo($params.b)', twoParams)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('"a"'))).toBe(true)
    }
  })

  it('params declared but no placeholder returns error', () => {
    const result = validateTemplate('vim.fn.getcwd()', oneRequiredParam)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(
        result.issues.some(
          (issue) => issue.code === 'DECLARED_PARAMS_NO_PLACEHOLDER',
        ),
      ).toBe(true)
      expect(result.errors.some((e) => e.includes('no $params'))).toBe(true)
    }
  })

  it('no params and no placeholder is valid', () => {
    const result = validateTemplate('vim.fn.getcwd()', noParams)
    expect(result.valid).toBe(true)
  })

  it('optional param not referenced in named template is valid', () => {
    // Only 'a' is required; 'b' is optional and not referenced
    const result = validateTemplate('foo($params.a)', twoParams)
    expect(result.valid).toBe(true)
  })

  it('valid result includes analysis', () => {
    const result = validateTemplate('vim.fn.expand($params)', oneRequiredParam)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.analysis.mode).toBe('positional')
    }
  })
})

// ============================================
// defaultToLua
// ============================================

describe('defaultToLua', () => {
  it('encodes string with double quotes', () => {
    expect(defaultToLua({ kind: 'scalar', value: 'hello' })).toBe('"hello"')
  })

  it('escapes backslashes in strings', () => {
    expect(defaultToLua({ kind: 'scalar', value: 'a\\b' })).toBe('"a\\\\b"')
  })

  it('escapes double quotes in strings', () => {
    expect(defaultToLua({ kind: 'scalar', value: 'say "hi"' })).toBe(
      '"say \\"hi\\""',
    )
  })

  it('encodes number as string', () => {
    expect(defaultToLua({ kind: 'scalar', value: 42 })).toBe('42')
  })

  it('encodes boolean true', () => {
    expect(defaultToLua({ kind: 'scalar', value: true })).toBe('true')
  })

  it('encodes boolean false', () => {
    expect(defaultToLua({ kind: 'scalar', value: false })).toBe('false')
  })

  it('lua kind returns raw string passthrough', () => {
    expect(defaultToLua({ kind: 'lua', lua: 'vim.fn.getcwd()' })).toBe(
      'vim.fn.getcwd()',
    )
  })

  it('encodes multiselect and object values', () => {
    expect(defaultToLua({ kind: 'multiselect', values: [] })).toBe('{}')
    expect(defaultToLua({ kind: 'multiselect', values: ['a', 'b'] })).toBe(
      '{ "a", "b" }',
    )
    expect(
      defaultToLua({
        kind: 'object',
        entries: {
          name: { kind: 'scalar', value: 'v' },
          'a-b': { kind: 'scalar', value: 'x' },
        },
      }),
    ).toBe('{ name = "v", ["a-b"] = "x" }')
  })
})

describe('groupDottedKeys', () => {
  it('groups dotted keys into nested object defaults', () => {
    const grouped = groupDottedKeys({
      'layout.preset': { kind: 'scalar', value: 'vertical' },
      'layout.preview': { kind: 'scalar', value: 'main' },
      'a.b.c': { kind: 'scalar', value: true },
    })
    expect(
      defaultToLua(requireDefined(grouped['layout'], 'grouped layout')),
    ).toBe('{ preset = "vertical", preview = "main" }')
    expect(defaultToLua(requireDefined(grouped['a'], 'grouped a'))).toBe(
      '{ b = { c = true } }',
    )
  })
})

// ============================================
// renderTemplate
// ============================================

describe('renderTemplate', () => {
  const params: RunFunctionParamSignature[] = [
    { name: 'expr', type: 'string', optional: false },
    { name: 'nosuf', type: 'string', optional: true },
  ]

  it('positional replaces $params with all values comma-separated', () => {
    const result = renderTemplate('vim.fn.expand($params)', params, {
      expr: { kind: 'scalar', value: '%:p:h' },
      nosuf: { kind: 'scalar', value: 0 },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('vim.fn.expand("%:p:h", 0)')
    }
  })

  it('named replaces each $params.<name> independently', () => {
    const namedParams: RunFunctionParamSignature[] = [
      { name: 'a', type: 'string', optional: false },
      { name: 'b', type: 'string', optional: false },
    ]
    const result = renderTemplate(
      "require('x').foo($params.a, $params.b)",
      namedParams,
      {
        a: { kind: 'scalar', value: 'hello' },
        b: { kind: 'scalar', value: 'world' },
      },
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('require(\'x\').foo("hello", "world")')
    }
  })

  it('connected values take priority over defaults', () => {
    const result = renderTemplate(
      'vim.fn.expand($params)',
      [{ name: 'expr', type: 'string', optional: false }],
      { expr: { kind: 'scalar', value: 'default' } },
      { expr: 'connected_value' },
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('vim.fn.expand(connected_value)')
    }
  })

  it('missing values fall back to nil', () => {
    const result = renderTemplate(
      'vim.fn.expand($params)',
      [{ name: 'expr', type: 'string', optional: false }],
      {},
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('vim.fn.expand(nil)')
    }
  })

  it('positional with no params produces empty string replacement', () => {
    const result = renderTemplate('vim.fn.getcwd($params)', [], {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('vim.fn.getcwd()')
    }
  })

  it('named mode replaces multiple occurrences of same placeholder', () => {
    const namedParams: RunFunctionParamSignature[] = [
      { name: 'x', type: 'string', optional: false },
    ]
    const result = renderTemplate(
      'foo($params.x) .. bar($params.x)',
      namedParams,
      { x: { kind: 'scalar', value: 'val' } },
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('foo("val") .. bar("val")')
    }
  })

  it('named mode handles overlapping placeholder names token-safely', () => {
    const namedParams: RunFunctionParamSignature[] = [
      { name: 'a', type: 'string', optional: false },
      { name: 'ab', type: 'string', optional: false },
    ]
    const result = renderTemplate('f($params.a, $params.ab)', namedParams, {
      a: { kind: 'scalar', value: 'x' },
      ab: { kind: 'scalar', value: 'y' },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('f("x", "y")')
      expect(result.lua).not.toContain('"x"b')
    }
  })
})
