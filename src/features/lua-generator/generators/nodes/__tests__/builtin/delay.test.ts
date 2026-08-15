// src/features/lua-generator/generators/nodes/__tests__/builtin/delay.test.ts
// Tests for automation.delay builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { delayGenerator } from '../../builtin/delay'
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
      builtinId: 'automation.delay',
      config,
    },
  }
}

describe('delayGenerator (builtin:automation.delay)', () => {
  describe('wrapping behavior', () => {
    it('wraps empty downstream in vim.defer_fn with correct delay', () => {
      const node = createBuiltinNode('delay1', { delayMs: 200 })
      const context = createMockContext({
        renderExecFromPort: vi.fn(() => []),
      })

      const result = delayGenerator.generate(node, context)

      expect(result.code).toEqual(['vim.defer_fn(function()', 'end, 200)'])
    })

    it('wraps downstream code inside vim.defer_fn callback body', () => {
      const node = createBuiltinNode('delay1', { delayMs: 100 })
      const context = createMockContext({
        renderExecFromPort: vi.fn(() => ['vim.cmd("write")', 'print("saved")']),
      })

      const result = delayGenerator.generate(node, context)

      expect(result.code).toEqual([
        'vim.defer_fn(function()',
        '  vim.cmd("write")',
        '  print("saved")',
        'end, 100)',
      ])
    })

    it('calls renderExecFromPort with the done port', () => {
      const node = createBuiltinNode('delay1', { delayMs: 50 })
      const renderExecFromPort = vi.fn(() => [])
      const context = createMockContext({ renderExecFromPort })

      delayGenerator.generate(node, context)

      expect(renderExecFromPort).toHaveBeenCalledWith('delay1', 'done')
    })
  })

  describe('delay value', () => {
    it('uses delayMs from config', () => {
      const node = createBuiltinNode('delay1', { delayMs: 500 })
      const context = createMockContext()

      const result = delayGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe('end, 500)')
    })

    it('defaults to 100ms when delayMs is missing', () => {
      const node = createBuiltinNode('delay1', {})
      const context = createMockContext()

      const result = delayGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe('end, 100)')
    })

    it('rounds decimal delay to integer', () => {
      const node = createBuiltinNode('delay1', { delayMs: 99.9 })
      const context = createMockContext()

      const result = delayGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe('end, 100)')
    })
  })

  describe('delay of 0ms', () => {
    it('emits warning for 0ms delay', () => {
      const node = createBuiltinNode('delay1', { delayMs: 0 })
      const context = createMockContext()

      delayGenerator.generate(node, context)

      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'builtin-delay-zero',
          severity: 'warning',
        }),
      )
    })

    it('still generates valid code for 0ms delay', () => {
      const node = createBuiltinNode('delay1', { delayMs: 0 })
      const context = createMockContext()

      const result = delayGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe('end, 0)')
    })
  })

  describe('negative delay', () => {
    it('emits warning for negative delay', () => {
      const node = createBuiltinNode('delay1', { delayMs: -50 })
      const context = createMockContext()

      delayGenerator.generate(node, context)

      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'builtin-delay-negative',
          severity: 'warning',
        }),
      )
    })

    it('clamps negative delay to 0 in generated code', () => {
      const node = createBuiltinNode('delay1', { delayMs: -100 })
      const context = createMockContext()

      const result = delayGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe('end, 0)')
    })
  })

  describe('output bindings', () => {
    it('sets done output binding', () => {
      const node = createBuiltinNode('delay1', { delayMs: 100 })
      const result = delayGenerator.generate(node, createMockContext())
      expect(result.outputBindings['done']).toBe('nil')
    })

    it('returns no local vars', () => {
      const node = createBuiltinNode('delay1', { delayMs: 100 })
      const result = delayGenerator.generate(node, createMockContext())
      expect(result.localVars).toEqual([])
    })
  })
})
