// src/features/lua-generator/generators/nodes/__tests__/builtin/require-module.test.ts
// Tests for Require Module builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { requireModuleGenerator } from '../../builtin/require-module'
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

describe('requireModuleGenerator', () => {
  it('generates simple require with variable assignment', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: 'telescope',
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code).toHaveLength(1)
    expect(result.code[0]).toBe("local _mod_1 = require('telescope')")
    expect(result.localVars).toContain('_mod_1')
  })

  it('emits error when module name is missing', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: '',
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code).toEqual([])
    expect(context.emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'builtin-require-missing-module',
        severity: 'error',
      }),
    )
  })

  it('emits error when module name is not a string', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: 123,
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code).toEqual([])
    expect(context.emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'builtin-require-missing-module',
        severity: 'error',
      }),
    )
  })

  it('escapes single quotes in module name', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: "user's.plugin",
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code[0]).toBe("local _mod_1 = require('user\\'s.plugin')")
  })

  it('generates bare require when assignToVariable is false', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: 'plugin',
      assignToVariable: false,
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code[0]).toBe("require('plugin')")
    expect(result.localVars).toEqual([])
  })

  it('defaults to variable assignment when assignToVariable is undefined', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: 'plugin',
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code[0]).toContain('local')
    expect(result.localVars.length).toBeGreaterThan(0)
  })

  it('trims whitespace from module name', () => {
    const node = createBuiltinNode('req1', 'require-module', {
      moduleName: '  telescope  ',
    })
    const context = createMockContext()

    const result = requireModuleGenerator.generate(node, context)

    expect(result.code[0]).toBe("local _mod_1 = require('telescope')")
  })
})
