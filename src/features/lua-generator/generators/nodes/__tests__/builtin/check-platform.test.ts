// src/features/lua-generator/generators/nodes/__tests__/builtin/check-platform.test.ts
// Tests for Check Platform builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { checkPlatformGenerator } from '../../builtin/check-platform'
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

describe('checkPlatformGenerator', () => {
  it('generates vim.fn.has check for valid platform', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: 'win32',
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    expect(result.code).toHaveLength(1)
    expect(result.code[0]).toBe("local _is_1 = vim.fn.has('win32') == 1")
    expect(result.localVars).toContain('_is_1')
  })

  it('generates check for mac platform', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: 'mac',
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    expect(result.code[0]).toBe("local _is_1 = vim.fn.has('mac') == 1")
  })

  it('generates check for unix platform', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: 'unix',
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    expect(result.code[0]).toBe("local _is_1 = vim.fn.has('unix') == 1")
  })

  it('emits error when platform is empty', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: '',
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    expect(result.code).toEqual([])
    expect(context.emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'builtin-check-platform-missing',
        severity: 'error',
      }),
    )
  })

  it('emits warning for unknown platform', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: 'unknown_os',
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    // Should still generate code
    expect(result.code.length).toBeGreaterThan(0)

    // But should emit warning
    expect(context.emitDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'builtin-check-platform-unknown',
        severity: 'warning',
      }),
    )
  })

  it('does not emit warning for known platforms', () => {
    const knownPlatforms = ['win32', 'mac', 'unix', 'linux', 'win64']

    for (const platform of knownPlatforms) {
      const node = createBuiltinNode(`plat-${platform}`, 'check-platform', {
        platform,
      })
      const context = createMockContext()

      checkPlatformGenerator.generate(node, context)

      const warningCalls = (
        context.emitDiagnostic as ReturnType<typeof vi.fn>
      ).mock.calls.filter(
        (call) => call[0].id === 'builtin-check-platform-unknown',
      )
      expect(warningCalls).toHaveLength(0)
    }
  })

  it('escapes single quotes in platform', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: "user's_os",
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    expect(result.code[0]).toContain("'user\\'s_os'")
  })

  it('trims whitespace from platform', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: '  win32  ',
    })
    const context = createMockContext()

    const result = checkPlatformGenerator.generate(node, context)

    expect(result.code[0]).toContain("'win32'")
  })

  it('generates code case-insensitively for known platforms', () => {
    const node = createBuiltinNode('plat1', 'check-platform', {
      platform: 'WIN32',
    })
    const context = createMockContext()

    checkPlatformGenerator.generate(node, context)

    // Should not warn for case variations
    const warningCalls = (
      context.emitDiagnostic as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      (call) => call[0].id === 'builtin-check-platform-unknown',
    )
    expect(warningCalls).toHaveLength(0)
  })
})
