// src/features/lua-generator/generators/nodes/action/__tests__/get-variable.test.ts
// Tests for get-variable action node generator (legacy form)

import { describe, expect, it } from 'vitest'
import type {
  ActionNodeDataFor,
  GetVariableActionConfig,
  GraphNode,
} from '@/shared/types'
import type { GenerationContext } from '../../types'
import { generateGetVariableAction } from '../get-variable'

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
 * Config partial type for testing.
 */
type TestConfig = Partial<GetVariableActionConfig>

/**
 * Create a test node for get-variable.
 */
function createTestNode(
  config: TestConfig = {},
): GraphNode<ActionNodeDataFor<'get-variable'>> {
  return {
    id: 'test-node',
    type: 'action',
    definitionId: 'action-get-variable',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'get-variable',
      label: 'Get Variable',
      displayName: 'Get Variable',
      actionConfig: {
        actionConfigType: 'get-variable',
        scope: config.scope ?? 'g',
        variableName: config.variableName ?? 'my_var',
      },
    },
  }
}

describe('generateGetVariableAction', () => {
  describe('variable access', () => {
    it('generates global variable access (vim.g)', () => {
      const node = createTestNode({
        scope: 'g',
        variableName: 'my_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('vim.g.my_var')
    })

    it('generates buffer variable access (vim.b)', () => {
      const node = createTestNode({
        scope: 'b',
        variableName: 'buffer_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.b.buffer_var')
    })

    it('generates window variable access (vim.w)', () => {
      const node = createTestNode({
        scope: 'w',
        variableName: 'window_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.w.window_var')
    })

    it('generates tab variable access (vim.t)', () => {
      const node = createTestNode({
        scope: 't',
        variableName: 'tab_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.t.tab_var')
    })

    it('generates vim variable access (vim.v)', () => {
      const node = createTestNode({
        scope: 'v',
        variableName: 'vim_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.v.vim_var')
    })
  })

  describe('identifier handling', () => {
    it('uses dot notation for valid identifiers', () => {
      const node = createTestNode({
        scope: 'g',
        variableName: 'valid_identifier_123',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.g.valid_identifier_123')
      expect(result.code[0]).not.toContain('[')
    })

    it('uses bracket notation for special characters', () => {
      const node = createTestNode({
        scope: 'g',
        variableName: 'my-var.with#special',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.g["my-var.with#special"]')
    })

    it('uses bracket notation for names starting with digit', () => {
      const node = createTestNode({
        scope: 'g',
        variableName: '123var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toContain('vim.g["123var"]')
    })
  })

  describe('output variable', () => {
    it('declares local variable for value', () => {
      const node = createTestNode({
        scope: 'g',
        variableName: 'my_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.code[0]).toMatch(/local _nvimset_test-node_value =/)
      expect(result.localVars).toContain('_nvimset_test-node_value')
    })

    it('exposes value in output bindings', () => {
      const node = createTestNode({
        scope: 'g',
        variableName: 'my_var',
      })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.outputBindings['value']).toBe('_nvimset_test-node_value')
    })
  })

  describe('legacy warning', () => {
    it('emits deprecation warning', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode()
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      generateGetVariableAction(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('deprecated')
      expect(warning?.message).toContain('action:get-variable')
    })

    it('suggests using builtin:get-variable', () => {
      const diagnostics: Array<{
        severity: string
        message: string
        details?: string | undefined
      }> = []
      const node = createTestNode()
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({
            severity: d.severity,
            message: d.message,
            details: d.details ?? undefined,
          }),
      })
      generateGetVariableAction(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning?.details).toContain('builtin:get-variable')
    })
  })

  describe('validation', () => {
    it('returns empty unit when variable name is empty', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({ variableName: '' })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateGetVariableAction(node, context)

      expect(result.code).toHaveLength(0)
      const error = diagnostics.find((d) => d.severity === 'error')
      expect(error).toBeDefined()
      expect(error?.message).toContain('requires a variable name')
    })

    it('returns empty unit for invalid scope', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        scope: 'x' as 'g', // Invalid scope
        variableName: 'test',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateGetVariableAction(node, context)

      expect(result.code).toHaveLength(0)
      const error = diagnostics.find((d) => d.severity === 'error')
      expect(error).toBeDefined()
      expect(error?.message).toContain('Invalid scope')
    })
  })

  describe('output bindings', () => {
    it('provides done output binding', () => {
      const node = createTestNode({ variableName: 'test' })
      const context = createTestContext()
      const result = generateGetVariableAction(node, context)

      expect(result.outputBindings['done']).toBe('nil')
    })
  })
})
