// src/features/lua-generator/generators/nodes/__tests__/run-function.test.ts
// Tests for run-function node generator

import { describe, expect, it, vi } from 'vitest'
import type { GraphNode, RunFunctionNodeData } from '@/shared/types'
import type {
  RunFunctionDefaultValue,
  RunFunctionSignatureSnapshot,
} from '@/shared/types/run-function'
import { runFunctionGenerator } from '../run-function'
import type { GenerationContext } from '../types'

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

function createRunFunctionNode(
  id: string,
  opts: {
    selectedFunctionKey?: string
    functionSource?: RunFunctionNodeData['functionSource']
    signature?: RunFunctionSignatureSnapshot | null
    paramDefaults?: Record<string, RunFunctionDefaultValue>
  } = {},
): GraphNode<RunFunctionNodeData> {
  return {
    id,
    type: 'run-function',
    definitionId: `run-function-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'run-function',
      displayName: 'Run Function',
      selectedFunctionKey: opts.selectedFunctionKey ?? 'core:vim_hover',
      functionSource: opts.functionSource ?? {
        type: 'core',
        functionName: 'vim.lsp.buf.hover',
      },
      signature: opts.signature !== undefined ? opts.signature : null,
      paramDefaults: opts.paramDefaults ?? {},
    },
  }
}

// ============================================
// Tests
// ============================================

describe('runFunctionGenerator', () => {
  describe('missing signature', () => {
    it('emits error and returns empty unit when signature is null', () => {
      const node = createRunFunctionNode('fn1', { signature: null })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(result.localVars).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-function-missing-signature',
          severity: 'error',
        }),
      )
    })
  })

  describe('core function with no params', () => {
    it('generates a simple call with no arguments', () => {
      const node = createRunFunctionNode('fn1', {
        functionSource: { type: 'core', functionName: 'vim.lsp.buf.hover' },
        signature: {
          params: [],
          returns: 'void',
          luaCall: 'vim.lsp.buf.hover()',
        },
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('vim.lsp.buf.hover()')
      expect(result.localVars).toEqual([])
      expect(result.outputBindings['result']).toBeUndefined()
      expect(result.outputBindings['done']).toBe('nil')
    })

    it('captures return value when returns is not void', () => {
      const node = createRunFunctionNode('fn1', {
        functionSource: { type: 'core', functionName: 'vim.fn.expand' },
        signature: {
          params: [],
          returns: 'string',
          luaCall: 'vim.fn.expand("%:p")',
        },
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('local _result_1 = vim.fn.expand("%:p")')
      expect(result.localVars).toContain('_result_1')
      expect(result.outputBindings['result']).toBe('_result_1')
    })
  })

  describe('positional params from connections', () => {
    it('substitutes connected param values via positional $params', () => {
      const node = createRunFunctionNode('fn1', {
        functionSource: {
          type: 'plugin',
          pluginId: 'telescope',
          functionName: 'find_files',
        },
        signature: {
          params: [{ name: 'cwd', type: 'string' }],
          returns: 'void',
          luaCall: 'require("telescope.builtin").find_files($params)',
        },
      })
      const context = createMockContext({
        inputBindings: { 'param:cwd': 'my_dir_var' },
      })

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'require("telescope.builtin").find_files(my_dir_var)',
      )
    })
  })

  describe('named params from connections', () => {
    it('substitutes named $params.<name> placeholders with connected values', () => {
      const node = createRunFunctionNode('fn1', {
        functionSource: { type: 'core', functionName: 'vim.fn.setqflist' },
        signature: {
          params: [
            { name: 'list', type: 'table' },
            { name: 'action', type: 'string', optional: true },
          ],
          returns: 'void',
          luaCall: 'vim.fn.setqflist($params.list, $params.action)',
        },
      })
      const context = createMockContext({
        inputBindings: {
          'param:list': 'qf_items',
          'param:action': '"a"',
        },
      })

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('vim.fn.setqflist(qf_items, "a")')
    })
  })

  describe('param defaults', () => {
    it('uses scalar default when param has no connection', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [{ name: 'path', type: 'string' }],
          returns: 'string',
          luaCall: 'vim.fn.expand($params)',
        },
        paramDefaults: {
          path: { kind: 'scalar', value: '%:p' },
        },
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('local _result_1 = vim.fn.expand("%:p")')
    })

    it('uses lua default when param has no connection', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [{ name: 'bufnr', type: 'number' }],
          returns: 'void',
          luaCall: 'vim.lsp.buf_request($params)',
        },
        paramDefaults: {
          bufnr: { kind: 'lua', lua: 'vim.api.nvim_get_current_buf()' },
        },
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'vim.lsp.buf_request(vim.api.nvim_get_current_buf())',
      )
    })

    it('prefers connected value over param default', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [{ name: 'path', type: 'string' }],
          returns: 'string',
          luaCall: 'vim.fn.expand($params)',
        },
        paramDefaults: {
          path: { kind: 'scalar', value: '%:p' },
        },
      })
      const context = createMockContext({
        inputBindings: { 'param:path': 'custom_path_var' },
      })

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'local _result_1 = vim.fn.expand(custom_path_var)',
      )
    })
  })

  describe('missing required param', () => {
    it('emits error when required param has no connection or default', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [{ name: 'path', type: 'string' }],
          returns: 'void',
          luaCall: 'vim.cmd.edit($params)',
        },
        paramDefaults: {},
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-function-missing-required-param',
          severity: 'error',
        }),
      )
    })

    it('does NOT emit error for optional param with no connection or default', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [{ name: 'path', type: 'string', optional: true }],
          returns: 'void',
          luaCall: 'vim.cmd.edit($params)',
        },
        paramDefaults: {},
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      // Should succeed, using nil for the optional param
      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('vim.cmd.edit(nil)')
      expect(context.emitDiagnostic).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-missing-required-param' }),
      )
    })

    it('emits nil for unset optional named param without missing-required diagnostics', () => {
      const node = createRunFunctionNode('fn-optional-named', {
        functionSource: {
          type: 'plugin',
          pluginId: 'snacks-nvim',
          functionName: 'explorer_open',
        },
        signature: {
          params: [{ name: 'cwd', type: 'string', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.explorer.open({ cwd = $params.cwd })',
        },
        paramDefaults: {},
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('Snacks.explorer.open({ cwd = nil })')
      expect(context.emitDiagnostic).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-missing-required-param' }),
      )
    })
  })

  describe('invalid template', () => {
    it('emits error for template that mixes positional and named placeholders', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [
            { name: 'a', type: 'string' },
            { name: 'b', type: 'string' },
          ],
          returns: 'void',
          // Mixing $params and $params.b is invalid
          luaCall: 'some_fn($params, $params.b)',
        },
        paramDefaults: {
          a: { kind: 'scalar', value: 'x' },
          b: { kind: 'scalar', value: 'y' },
        },
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-function-invalid-template',
          severity: 'error',
        }),
      )
    })
  })

  describe('return value omitted when void', () => {
    it('does NOT assign a local variable when returns is void', () => {
      const node = createRunFunctionNode('fn1', {
        signature: {
          params: [],
          returns: 'void',
          luaCall: 'vim.cmd("write")',
        },
      })
      const context = createMockContext()

      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe('vim.cmd("write")')
      expect(result.localVars).toEqual([])
      expect(result.outputBindings['result']).toBeUndefined()
    })
  })

  describe('structured + opts merge', () => {
    it('merges structured defaults with opts lua via vim.tbl_extend', () => {
      const node = createRunFunctionNode('fn-opts', {
        signature: {
          params: [{ name: 'opts', type: 'any', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.picker.grep($params)',
        },
        paramDefaults: {
          cwd: { kind: 'scalar', value: '/tmp' },
          opts: { kind: 'lua', lua: '{ foo = 1 }' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)
      expect(result.code[0]).toBe(
        'Snacks.picker.grep(vim.tbl_extend("force", { foo = 1 }, { cwd = "/tmp" }))',
      )
    })

    it('uses only structured table when opts is absent', () => {
      const node = createRunFunctionNode('fn-opts2', {
        signature: {
          params: [{ name: 'opts', type: 'any', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.picker.grep($params)',
        },
        paramDefaults: {
          cwd: { kind: 'scalar', value: '/tmp' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)
      expect(result.code[0]).toBe('Snacks.picker.grep({ cwd = "/tmp" })')
    })

    it('builds single options table for structured picker params', () => {
      const node = createRunFunctionNode('fn-opts3', {
        signature: {
          params: [
            { name: 'cwd', type: 'string', optional: true },
            { name: 'layout.preset', type: 'string', optional: true },
            { name: 'opts', type: 'any', optional: true },
          ],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          cwd: { kind: 'scalar', value: '/tmp' },
          'layout.preset': { kind: 'scalar', value: 'ivy' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)
      expect(result.code[0]).toBe(
        'Snacks.picker.files({ cwd = "/tmp", layout = { preset = "ivy" } })',
      )
    })

    it('uses opts-only for picker when no structured params are set', () => {
      const node = createRunFunctionNode('fn-opts4', {
        signature: {
          params: [
            { name: 'cwd', type: 'string', optional: true },
            { name: 'opts', type: 'any', optional: true },
          ],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          opts: { kind: 'lua', lua: '{ hidden = true }' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)
      expect(result.code[0]).toBe('Snacks.picker.files({ hidden = true })')
    })

    it('coerces numeric string defaults to bare Lua numbers and emits diagnostics', () => {
      const node = createRunFunctionNode('fn-opts5', {
        selectedFunctionKey: 'Snacks.picker.files',
        signature: {
          params: [{ name: 'layout.width', type: 'number', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          'layout.width': { kind: 'scalar', value: '40' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'Snacks.picker.files({ layout = { width = 40 } })',
      )
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-param-coerced' }),
      )
    })

    it('normalizes nested object-shaped params recursively', () => {
      const node = createRunFunctionNode('fn-opts6', {
        selectedFunctionKey: 'Snacks.picker.files',
        signature: {
          params: [
            {
              name: 'layout',
              type: 'table',
              optional: true,
              objectShape: [{ name: 'width', type: 'number', optional: true }],
            },
          ],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          layout: {
            kind: 'object',
            entries: {
              width: { kind: 'scalar', value: '40' },
            },
          },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'Snacks.picker.files({ layout = { width = 40 } })',
      )
    })

    it('renders dotted defaults nested under required object-shaped table params', () => {
      const node = createRunFunctionNode('fn-opts-object-shape', {
        selectedFunctionKey: 'Snacks.picker.files',
        signature: {
          params: [
            {
              name: 'layout',
              type: 'table',
              optional: false,
              objectShape: [{ name: 'width', type: 'number', optional: true }],
            },
          ],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          'layout.width': { kind: 'scalar', value: '40' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'Snacks.picker.files({ layout = { width = 40 } })',
      )
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-param-coerced' }),
      )
      expect(context.emitDiagnostic).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-missing-required-param' }),
      )
    })

    it('drops invalid numeric defaults and reports a missing required param', () => {
      const node = createRunFunctionNode('fn-opts7', {
        selectedFunctionKey: 'Snacks.picker.files',
        signature: {
          params: [{ name: 'layout.width', type: 'number', optional: false }],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          'layout.width': { kind: 'scalar', value: 'wide' },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-param-dropped' }),
      )
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-missing-required-param' }),
      )
    })

    it.each([
      '',
      '   ',
      'Infinity',
      '-Infinity',
      'NaN',
    ])('drops invalid numeric string default %j for Snacks pickers', (rawValue) => {
      const node = createRunFunctionNode(`fn-invalid-${String(rawValue)}`, {
        selectedFunctionKey: 'Snacks.picker.files',
        signature: {
          params: [{ name: 'layout.width', type: 'number', optional: true }],
          returns: 'void',
          luaCall: 'Snacks.picker.files($params)',
        },
        paramDefaults: {
          'layout.width': { kind: 'scalar', value: rawValue },
        },
      })
      const context = createMockContext()
      const result = runFunctionGenerator.generate(node, context)
      const output = result.code[0] ?? ''

      expect(output).toBe('Snacks.picker.files({})')
      expect(output).not.toContain(' = 0')
      expect(output.toLowerCase()).not.toContain('inf')
      expect(output.toLowerCase()).not.toContain('nan')
      expect(output).not.toContain('"Infinity"')
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'run-function-param-dropped' }),
      )
    })
  })
})
