// src/features/lua-generator/generators/nodes/__tests__/builtin/check-feature.test.ts
// Tests for Check Feature builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { checkFeatureGenerator } from '../../builtin/check-feature'
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

describe('checkFeatureGenerator', () => {
  it('generates vim.fn.has check for valid feature', () => {
    const node = createBuiltinNode('feat1', 'check-feature', {
      feature: 'clipboard',
    })
    const context = createMockContext()

    const result = checkFeatureGenerator.generate(node, context)

    expect(result.code).toHaveLength(1)
    expect(result.code[0]).toBe("local _has_1 = vim.fn.has('clipboard') == 1")
    expect(result.localVars).toContain('_has_1')
  })

  it('emits error when feature name is empty', () => {
    const node = createBuiltinNode('feat1', 'check-feature', {
      feature: '',
    })
    const context = createMockContext()

    const result = checkFeatureGenerator.generate(node, context)

    expect(result.code).toEqual([])
    expect(context.emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'builtin-check-feature-missing',
        severity: 'error',
      }),
    )
  })

  it('emits warning for unknown feature', () => {
    const node = createBuiltinNode('feat1', 'check-feature', {
      feature: 'unknown_feature_xyz',
    })
    const context = createMockContext()

    const result = checkFeatureGenerator.generate(node, context)

    // Should still generate code
    expect(result.code.length).toBeGreaterThan(0)

    // But should emit warning
    expect(context.emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'builtin-check-feature-unknown',
        severity: 'warning',
      }),
    )
  })

  it('does not emit warning for known features', () => {
    const knownFeatures = ['clipboard', 'python3', 'nvim', 'gui_running']

    for (const feature of knownFeatures) {
      const node = createBuiltinNode(`feat-${feature}`, 'check-feature', {
        feature,
      })
      const context = createMockContext()

      checkFeatureGenerator.generate(node, context)

      const warningCalls = (
        context.emitDiagnostic as ReturnType<typeof vi.fn>
      ).mock.calls.filter(
        (call) => call[0].id === 'builtin-check-feature-unknown',
      )
      expect(warningCalls).toHaveLength(0)
    }
  })

  it('escapes single quotes in feature name', () => {
    const node = createBuiltinNode('feat1', 'check-feature', {
      feature: "user's_feature",
    })
    const context = createMockContext()

    const result = checkFeatureGenerator.generate(node, context)

    expect(result.code[0]).toContain("'user\\'s_feature'")
  })

  it('trims whitespace from feature name', () => {
    const node = createBuiltinNode('feat1', 'check-feature', {
      feature: '  clipboard  ',
    })
    const context = createMockContext()

    const result = checkFeatureGenerator.generate(node, context)

    expect(result.code[0]).toContain("'clipboard'")
  })

  it('generates code case-insensitively for known features', () => {
    const node = createBuiltinNode('feat1', 'check-feature', {
      feature: 'CLIPBOARD',
    })
    const context = createMockContext()

    checkFeatureGenerator.generate(node, context)

    // Should not warn for case variations
    const warningCalls = (
      context.emitDiagnostic as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      (call) => call[0].id === 'builtin-check-feature-unknown',
    )
    expect(warningCalls).toHaveLength(0)
  })
})
