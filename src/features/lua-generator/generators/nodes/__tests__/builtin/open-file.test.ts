// src/features/lua-generator/generators/nodes/__tests__/builtin/open-file.test.ts
// Tests for buffers.open-file builtin generator

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinNodeData, GraphNode } from '@/shared/types'
import { openFileGenerator } from '../../builtin/open-file'
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
      builtinId: 'buffers.open-file',
      config,
    },
  }
}

describe('openFileGenerator (builtin:buffers.open-file)', () => {
  describe('open modes', () => {
    it('generates vim.cmd with edit mode', () => {
      const node = createBuiltinNode('open1', {
        path: '/home/user/init.lua',
        mode: 'edit',
      })
      const context = createMockContext()

      const result = openFileGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe(
        'vim.cmd(\'edit \' .. vim.fn.fnameescape("/home/user/init.lua"))',
      )
    })

    it('generates vim.cmd with split mode', () => {
      const node = createBuiltinNode('open1', {
        path: '/path/to/file.txt',
        mode: 'split',
      })
      const result = openFileGenerator.generate(node, createMockContext())
      expect(result.code[0]).toBe(
        'vim.cmd(\'split \' .. vim.fn.fnameescape("/path/to/file.txt"))',
      )
    })

    it('generates vim.cmd with vsplit mode', () => {
      const node = createBuiltinNode('open1', {
        path: '/path/to/file.txt',
        mode: 'vsplit',
      })
      const result = openFileGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain("'vsplit '")
    })

    it('generates vim.cmd with tabedit mode', () => {
      const node = createBuiltinNode('open1', {
        path: '/path/to/file.txt',
        mode: 'tabedit',
      })
      const result = openFileGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain("'tabedit '")
    })

    it('defaults to edit mode for unknown mode value', () => {
      const node = createBuiltinNode('open1', {
        path: '/path/to/file.txt',
        mode: 'invalid-mode',
      })
      const result = openFileGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain("'edit '")
    })
  })

  describe('path resolution', () => {
    it('uses config path when no data port is connected', () => {
      const node = createBuiltinNode('open1', {
        path: '/config/path.lua',
        mode: 'edit',
      })
      const result = openFileGenerator.generate(node, createMockContext())
      expect(result.code[0]).toContain('"/config/path.lua"')
    })

    it('uses connected path input over config path', () => {
      const node = createBuiltinNode('open1', {
        path: '/config/path.lua',
        mode: 'edit',
      })
      const context = createMockContext({
        inputBindings: { path: 'dynamic_path_var' },
      })

      const result = openFileGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        "vim.cmd('edit ' .. vim.fn.fnameescape(dynamic_path_var))",
      )
    })
  })

  describe('empty path warning', () => {
    it('emits warning when path is empty and no data connection', () => {
      const node = createBuiltinNode('open1', {
        path: '',
        mode: 'edit',
      })
      const context = createMockContext()

      openFileGenerator.generate(node, context)

      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'builtin-open-file-missing-path',
          severity: 'warning',
        }),
      )
    })

    it('does NOT emit warning when path data port is connected', () => {
      const node = createBuiltinNode('open1', {
        path: '',
        mode: 'edit',
      })
      const context = createMockContext({
        inputBindings: { path: 'some_var' },
      })

      openFileGenerator.generate(node, context)

      expect(context.emitDiagnostic).not.toHaveBeenCalled()
    })

    it('does NOT emit warning when config path is non-empty', () => {
      const node = createBuiltinNode('open1', {
        path: '/valid/path.lua',
        mode: 'edit',
      })
      const context = createMockContext()

      openFileGenerator.generate(node, context)

      expect(context.emitDiagnostic).not.toHaveBeenCalled()
    })

    it('still generates code even with empty path', () => {
      const node = createBuiltinNode('open1', { path: '', mode: 'edit' })
      const result = openFileGenerator.generate(node, createMockContext())
      // Should generate code (with empty string literal)
      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('vim.cmd')
    })
  })
})
