// Tests for Set Variable Action Node Generator

import { describe, expect, it } from 'vitest'
import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import type { GenerationDiagnostic } from '../../../../diagnostics/types'
import type { GenerationContext } from '../../types'
import { generateSetVariable } from '../set-variable'

function createMockNode(
  scope: 'g' | 'b' | 'w' | 't' | 'v',
  variableName: string,
  valueType: 'string' | 'number' | 'boolean' | 'raw',
  value: string | number | boolean,
): GraphNode<ActionNodeDataFor<'set-variable'>> {
  return {
    id: 'test-node-1',
    type: 'action',
    definitionId: 'action:set-variable',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'set-variable',
      label: 'Set Variable',
      actionConfig: {
        actionConfigType: 'set-variable',
        scope,
        variableName,
        valueType,
        value,
      },
    },
  }
}

function createMockContext(
  inputBindings: Record<string, string> = {},
  toLuaLiteral = (v: unknown): string => {
    if (typeof v === 'string') return `"${v}"`
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    return String(v)
  },
): GenerationContext {
  const diagnostics: GenerationDiagnostic[] = []

  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map(),
    edges: [],
    inputBindings,
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: () => [],
    sanitizeIdentifier: (s): string => s.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral,
    emitDiagnostic: (d): number => diagnostics.push(d),
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint): string => `_${hint ?? 'var'}`,
  }
}

describe('generateSetVariable', () => {
  describe('happy path', () => {
    it('generates global variable assignment', () => {
      const node = createMockNode('g', 'my_var', 'string', 'hello')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('vim.g.my_var = "hello"')
    })

    it('generates buffer-local variable assignment', () => {
      const node = createMockNode('b', 'buffer_var', 'number', 42)
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.b.buffer_var = 42')
    })

    it('generates window-local variable assignment', () => {
      const node = createMockNode('w', 'win_var', 'boolean', true)
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.w.win_var = true')
    })

    it('generates tab-local variable assignment', () => {
      const node = createMockNode('t', 'tab_var', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.t.tab_var = "value"')
    })

    it('generates vim variable assignment', () => {
      const node = createMockNode('v', 'vim_var', 'string', 'test')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.v.vim_var = "test"')
    })

    it('generates raw Lua expression', () => {
      const node = createMockNode('g', 'raw_var', 'raw', '{ a = 1, b = 2 }')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g.raw_var = { a = 1, b = 2 }')
    })

    it('uses bracket notation for invalid identifiers', () => {
      const node = createMockNode('g', 'my-var', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g["my-var"] = "value"')
    })

    it('uses connected input value over config', () => {
      const node = createMockNode('g', 'my_var', 'string', 'config_value')
      const context = createMockContext({ value: 'connected_value' })

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g.my_var = connected_value')
    })
  })

  describe('config validation', () => {
    it('emits error for empty variable name', () => {
      const node = createMockNode('g', '', 'string', 'value')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetVariable(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('variable name')
    })

    it('emits error for whitespace-only variable name', () => {
      const node = createMockNode('g', '   ', 'string', 'value')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetVariable(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
    })

    it('emits error for invalid scope', () => {
      const node = createMockNode('x' as 'g', 'my_var', 'string', 'value')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetVariable(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.message).toContain('invalid scope')
    })

    it('emits error for empty raw value', () => {
      const node = createMockNode('g', 'my_var', 'raw', '')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetVariable(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
    })
  })

  describe('escaping', () => {
    it('escapes quotes in variable name', () => {
      const node = createMockNode('g', 'var"name', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      // The output contains escaped quotes
      expect(result.code[0]).toContain('var\\\\"name')
    })

    it('escapes backslashes in variable name', () => {
      const node = createMockNode('g', 'var\\name', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g["var\\\\name"] = "value"')
    })

    it('trims whitespace from variable name', () => {
      const node = createMockNode('g', '  my_var  ', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g.my_var = "value"')
    })
  })

  describe('identifier validation', () => {
    it('uses dot notation for valid identifiers starting with underscore', () => {
      const node = createMockNode('g', '_private_var', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g._private_var = "value"')
    })

    it('uses dot notation for valid identifiers with numbers', () => {
      const node = createMockNode('g', 'var123', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g.var123 = "value"')
    })

    it('uses bracket notation for names starting with numbers', () => {
      const node = createMockNode('g', '123var', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g["123var"] = "value"')
    })

    it('uses bracket notation for names with special characters', () => {
      const node = createMockNode('g', 'my.var', 'string', 'value')
      const context = createMockContext()

      const result = generateSetVariable(node, context)

      expect(result.code[0]).toBe('vim.g["my.var"] = "value"')
    })
  })
})
