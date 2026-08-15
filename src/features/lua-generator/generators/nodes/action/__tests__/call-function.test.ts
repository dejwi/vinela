// src/features/lua-generator/generators/nodes/action/__tests__/call-function.test.ts
// Tests for call-function action node generator

import { describe, expect, it } from 'vitest'
import type { ActionNodeData, GraphNode } from '@/shared/types'
import type { GenerationContext } from '../../types'
import {
  type CallFunctionActionConfig,
  callFunctionGenerator,
} from '../call-function'

/**
 * Create a minimal GenerationContext for testing.
 */
function createTestContext(
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
    renderExecFromPort: () => [],
    sanitizeIdentifier: (raw) => raw.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (value) => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'number') return String(value)
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      return 'nil'
    },
    emitDiagnostic: () => {},
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint = 'var') => `_${hint}`,
    ...overrides,
  }
}

/**
 * Create a test node for call-function.
 */
function createTestNode(
  config: Partial<CallFunctionActionConfig> = {},
): GraphNode<ActionNodeData> {
  return {
    id: 'test-node',
    type: 'action',
    definitionId: 'action-call-function',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'run-action',
      label: 'Call Function',
      displayName: 'Call Function',
      actionConfig: {
        actionConfigType: 'call-function',
        functionName: config.functionName ?? 'my_function',
        arguments: config.arguments ?? [],
        context: config.context ?? 'lua',
      },
    } as unknown as ActionNodeData,
  }
}

describe('generateCallFunction', () => {
  describe('Lua function calls', () => {
    it('generates simple Lua function call', () => {
      const node = createTestNode({
        functionName: 'my_function',
        context: 'lua',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('my_function()')
    })

    it('generates Lua function call with string arguments', () => {
      const node = createTestNode({
        functionName: 'print',
        arguments: ['"hello"', '"world"'],
        context: 'lua',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('print("hello", "world")')
    })

    it('generates Lua function call with mixed arguments', () => {
      const node = createTestNode({
        functionName: 'my_func',
        arguments: ['arg1', '42', 'true'],
        context: 'lua',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('my_func(arg1, 42, true)')
    })
  })

  describe('Vim function calls', () => {
    it('generates simple Vim function call', () => {
      const node = createTestNode({
        functionName: 'has',
        context: 'vim',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('vim.fn.has()')
    })

    it('generates Vim function call with arguments', () => {
      const node = createTestNode({
        functionName: 'has',
        arguments: ['"nvim-0.8"'],
        context: 'vim',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('vim.fn.has("nvim-0.8")')
    })

    it('generates expand function call', () => {
      const node = createTestNode({
        functionName: 'expand',
        arguments: ['"%:p"'],
        context: 'vim',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('vim.fn.expand("%:p")')
    })
  })

  describe('argument serialization', () => {
    it('serializes string arguments', () => {
      const node = createTestNode({
        functionName: 'test',
        arguments: ['"hello"'],
        context: 'lua',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code[0]).toContain('"hello"')
    })

    it('serializes number arguments via toLuaLiteral', () => {
      const node = createTestNode({
        functionName: 'test',
        arguments: [42, 3.14],
        context: 'lua',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      // Numbers are serialized via toLuaLiteral which adds quotes in test context
      expect(result.code[0]).toContain('42')
      expect(result.code[0]).toContain('3.14')
    })

    it('serializes boolean arguments via toLuaLiteral', () => {
      const node = createTestNode({
        functionName: 'test',
        arguments: [true, false],
        context: 'lua',
      })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      // Booleans are serialized via toLuaLiteral which adds quotes in test context
      expect(result.code[0]).toContain('true')
      expect(result.code[0]).toContain('false')
    })
  })

  describe('validation', () => {
    it('returns empty unit when function name is empty', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({ functionName: '' })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('requires a function name')
    })

    it('warns about invalid Lua function names', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        functionName: '123-invalid-name', // Invalid: starts with digit
        context: 'lua',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      callFunctionGenerator.generate(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('may not exist')
    })

    it('warns about unknown Vim functions', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        functionName: 'unknown_vim_function_xyz',
        context: 'vim',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      callFunctionGenerator.generate(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('may not exist')
    })

    it('does not warn for known Lua functions', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        functionName: 'valid_function',
        context: 'lua',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      callFunctionGenerator.generate(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeUndefined()
    })

    it('does not warn for known Vim functions', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        functionName: 'has',
        context: 'vim',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      callFunctionGenerator.generate(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeUndefined()
    })

    it('returns empty unit for invalid config', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({})
      // Override with invalid config
      node.data.actionConfig = {
        actionConfigType: 'run-action', // Wrong type
      } as unknown as ActionNodeData['actionConfig']

      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = callFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
    })
  })

  describe('output bindings', () => {
    it('provides done output binding', () => {
      const node = createTestNode({ functionName: 'test' })
      const context = createTestContext()
      const result = callFunctionGenerator.generate(node, context)

      expect(result.outputBindings['done']).toBe('nil')
    })
  })
})
