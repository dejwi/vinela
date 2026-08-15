// src/features/lua-generator/generators/nodes/__tests__/builtin/ui-notify.test.ts
// Tests for ui.notify builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { uiNotifyGenerator } from '../../builtin/ui-notify'
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
    toLuaLiteral: (value: unknown) => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'number') return String(value)
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      return 'nil'
    },
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
      builtinId: 'ui.notify',
      config,
    },
  }
}

describe('uiNotifyGenerator (builtin:ui.notify)', () => {
  describe('config-only message', () => {
    it('generates vim.notify with info level using config message', () => {
      const node = createBuiltinNode('notify1', {
        message: 'Hello World',
        level: 'info',
        title: '',
      })
      const context = createMockContext()

      const result = uiNotifyGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe(
        'vim.notify("Hello World", vim.log.levels.INFO)',
      )
    })

    it('uses default message when config message is missing', () => {
      const node = createBuiltinNode('notify1', { level: 'info' })
      const context = createMockContext()

      const result = uiNotifyGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'vim.notify("Configuration updated", vim.log.levels.INFO)',
      )
    })
  })

  describe('log levels', () => {
    it('maps info level to vim.log.levels.INFO', () => {
      const node = createBuiltinNode('n', { message: 'msg', level: 'info' })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('vim.log.levels.INFO')
    })

    it('maps warn level to vim.log.levels.WARN', () => {
      const node = createBuiltinNode('n', { message: 'msg', level: 'warn' })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('vim.log.levels.WARN')
    })

    it('maps error level to vim.log.levels.ERROR', () => {
      const node = createBuiltinNode('n', { message: 'msg', level: 'error' })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('vim.log.levels.ERROR')
    })

    it('maps debug level to vim.log.levels.DEBUG', () => {
      const node = createBuiltinNode('n', { message: 'msg', level: 'debug' })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('vim.log.levels.DEBUG')
    })

    it('maps trace level to vim.log.levels.TRACE', () => {
      const node = createBuiltinNode('n', { message: 'msg', level: 'trace' })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('vim.log.levels.TRACE')
    })

    it('defaults to INFO for unknown level', () => {
      const node = createBuiltinNode('n', {
        message: 'msg',
        level: 'unknown-level',
      })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('vim.log.levels.INFO')
    })
  })

  describe('with title', () => {
    it('adds options table when config title is non-empty', () => {
      const node = createBuiltinNode('notify1', {
        message: 'Hello',
        level: 'info',
        title: 'My Plugin',
      })
      const context = createMockContext()

      const result = uiNotifyGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'vim.notify("Hello", vim.log.levels.INFO, { title = "My Plugin" })',
      )
    })

    it('omits options table when title is empty string', () => {
      const node = createBuiltinNode('notify1', {
        message: 'Hello',
        level: 'info',
        title: '',
      })
      const result = uiNotifyGenerator.generate(node, createMockContext())
      expect(result.code[0]).toBe('vim.notify("Hello", vim.log.levels.INFO)')
    })
  })

  describe('data port connections', () => {
    it('uses connected message over config message', () => {
      const node = createBuiltinNode('notify1', {
        message: 'config message',
        level: 'info',
        title: '',
      })
      const context = createMockContext({
        inputBindings: { message: 'msg_var' },
      })

      const result = uiNotifyGenerator.generate(node, context)

      expect(result.code[0]).toBe('vim.notify(msg_var, vim.log.levels.INFO)')
    })

    it('uses connected title over config title', () => {
      const node = createBuiltinNode('notify1', {
        message: 'Hello',
        level: 'warn',
        title: 'Config Title',
      })
      const context = createMockContext({
        inputBindings: { title: 'dynamic_title' },
      })

      const result = uiNotifyGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'vim.notify("Hello", vim.log.levels.WARN, { title = dynamic_title })',
      )
    })

    it('includes options table when title port is connected even if config title is empty', () => {
      const node = createBuiltinNode('notify1', {
        message: 'Hello',
        level: 'info',
        title: '',
      })
      const context = createMockContext({
        inputBindings: { title: 'runtime_title' },
      })

      const result = uiNotifyGenerator.generate(node, context)

      expect(result.code[0]).toContain('{ title = runtime_title }')
    })
  })
})
