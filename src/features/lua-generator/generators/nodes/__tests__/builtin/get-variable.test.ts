// src/features/lua-generator/generators/nodes/__tests__/builtin/get-variable.test.ts
// Tests for Get Variable builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { getVariableGenerator } from '../../builtin/get-variable'
import type { GenerationContext } from '../../types'

function createMockContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map(),
    edges: [],
    inputBindings: {},
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: vi.fn(() => []),
    sanitizeIdentifier: (raw: string) => raw.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (value: unknown) => JSON.stringify(value),
    emitDiagnostic: vi.fn(),
    callableSymbolByGraphId: new Map(),
    getVariableName: vi.fn((hint = 'var') => `_${hint}_1`),
    ...overrides,
  }
}

function createBuiltinNode(
  id: string,
  builtinId: string,
  config: Record<string, unknown>,
): GraphNode<BuiltinNodeData> {
  return {
    id,
    type: 'builtin',
    definitionId: `builtin-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'builtin',
      builtinId,
      config,
    },
  }
}

describe('getVariableGenerator', () => {
  describe('basic access patterns', () => {
    it('generates vim.g access for global scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: 'my_var',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('local _var_1 = vim.g.my_var')
      expect(result.localVars).toContain('_var_1')
    })

    it('generates vim.b access for buffer scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'b',
        variableName: 'buffer_local',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.b.buffer_local')
    })

    it('generates vim.w access for window scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'w',
        variableName: 'window_var',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.w.window_var')
    })

    it('generates vim.t access for tab scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 't',
        variableName: 'tab_var',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.t.tab_var')
    })

    it('generates vim.v access for vim scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'v',
        variableName: 'count',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.v.count')
    })
  })

  describe('bracket notation', () => {
    it('uses bracket notation for names with hyphens', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: 'my-variable',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.g["my-variable"]')
    })

    it('uses bracket notation for names with spaces', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: 'my variable',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.g["my variable"]')
    })

    it('uses bracket notation for names starting with numbers', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: '123var',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.g["123var"]')
    })

    it('escapes quotes in variable names', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: 'say"hello"',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.g["say\\"hello\\""]')
    })
  })

  describe('indexed access', () => {
    it('uses indexed access when index is provided for buffer scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'b',
        variableName: 'my_var',
        index: 5,
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.b[5].my_var')
    })

    it('uses indexed bracket access for buffer with non-identifier name', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'b',
        variableName: 'my-var',
        index: 0,
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.b[0]["my-var"]')
    })

    it('uses indexed access for window scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'w',
        variableName: 'win_var',
        index: 1001,
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.w[1001].win_var')
    })

    it('uses indexed access for tab scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 't',
        variableName: 'tab_var',
        index: 1,
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.t[1].tab_var')
    })
  })

  describe('validation', () => {
    it('emits error for missing scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        variableName: 'my_var',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'builtin-get-variable-invalid-scope',
          severity: 'error',
        }),
      )
    })

    it('emits error for invalid scope', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'invalid',
        variableName: 'my_var',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'builtin-get-variable-invalid-scope',
          severity: 'error',
        }),
      )
    })

    it('emits error for missing variable name', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: '',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'builtin-get-variable-missing-name',
          severity: 'error',
        }),
      )
    })

    it('trims whitespace from variable name', () => {
      const node = createBuiltinNode('var1', 'get-variable', {
        scope: 'g',
        variableName: '  my_var  ',
      })
      const context = createMockContext()

      const result = getVariableGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _var_1 = vim.g.my_var')
    })
  })
})
