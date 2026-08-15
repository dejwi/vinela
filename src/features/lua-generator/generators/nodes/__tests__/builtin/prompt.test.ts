// src/features/lua-generator/generators/nodes/__tests__/builtin/prompt.test.ts
// Tests for input.prompt builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { promptGenerator } from '../../builtin/prompt'
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
  config: Record<string, unknown>,
): GraphNode<BuiltinNodeData> {
  return {
    id,
    type: 'builtin',
    definitionId: `builtin-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'builtin',
      builtinId: 'input.prompt',
      config,
    },
  }
}

describe('promptGenerator (builtin:input.prompt)', () => {
  describe('prompt with default value', () => {
    it('generates vim.fn.input with both prompt and default', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Enter name: ',
        defaultValue: 'John',
      })
      const context = createMockContext()

      const result = promptGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe(
        'local _value_1 = vim.fn.input("Enter name: ", "John")',
      )
    })
  })

  describe('prompt without default value', () => {
    it('generates vim.fn.input with only prompt when defaultValue is empty', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Input: ',
        defaultValue: '',
      })
      const context = createMockContext()

      const result = promptGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('local _value_1 = vim.fn.input("Input: ")')
    })

    it('omits second argument when defaultValue config is missing', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Search: ',
      })
      const context = createMockContext()

      const result = promptGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _value_1 = vim.fn.input("Search: ")')
      expect(result.code[0]).not.toContain(', "')
    })
  })

  describe('default prompt', () => {
    it('uses "Input: " when prompt config is missing', () => {
      const node = createBuiltinNode('prompt1', { defaultValue: '' })
      const context = createMockContext()

      const result = promptGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _value_1 = vim.fn.input("Input: ")')
    })
  })

  describe('value output port binding', () => {
    it('binds the value output port to the local variable', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Enter: ',
        defaultValue: '',
      })
      const context = createMockContext()

      const result = promptGenerator.generate(node, context)

      expect(result.outputBindings['value']).toBe('_value_1')
    })

    it('includes value variable in localVars', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Enter: ',
        defaultValue: '',
      })
      const result = promptGenerator.generate(node, createMockContext())
      expect(result.localVars).toContain('_value_1')
    })

    it('sets done output binding', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Enter: ',
        defaultValue: '',
      })
      const result = promptGenerator.generate(node, createMockContext())
      expect(result.outputBindings['done']).toBe('nil')
    })
  })

  describe('string escaping', () => {
    it('escapes double quotes in prompt text', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Say "hello": ',
        defaultValue: '',
      })
      const result = promptGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('"Say \\"hello\\": "')
    })

    it('escapes backslashes in prompt text', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Path (e.g. C:\\dir): ',
        defaultValue: '',
      })
      const result = promptGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('"Path (e.g. C:\\\\dir): "')
    })

    it('escapes double quotes in default value', () => {
      const node = createBuiltinNode('prompt1', {
        prompt: 'Enter: ',
        defaultValue: 'say "hi"',
      })
      const result = promptGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('"say \\"hi\\""')
    })
  })
})
