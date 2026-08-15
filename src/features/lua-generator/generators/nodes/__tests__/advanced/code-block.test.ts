// src/features/lua-generator/generators/nodes/__tests__/advanced/code-block.test.ts
// Tests for Code Block node generator - contract compliance

import { describe, expect, it, vi } from 'vitest'
import type { CodeBlockNodeData, GraphNode } from '@/shared/types'
import { codeBlockGenerator } from '../../advanced/code-block'
import type { GenerationContext } from '../../types'

/**
 * Create a mock GenerationContext for testing
 */
function createMockContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  const diagnostics: ReturnType<GenerationContext['emitDiagnostic']>[] = []

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
    emitDiagnostic: vi.fn((d) => {
      diagnostics.push(d)
    }),
    callableSymbolByGraphId: new Map(),
    getVariableName: vi.fn((hint = 'var') => `_${hint}_1`),
    ...overrides,
  }
}

/**
 * Create a Code Block node for testing
 */
function createCodeBlockNode(
  id: string,
  code: string,
  inputs: { id: string; name: string; dataType: string }[] = [],
  outputs: { id: string; name: string; dataType: string }[] = [],
): GraphNode<CodeBlockNodeData> {
  return {
    id,
    type: 'code-block',
    definitionId: `code-block-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'code-block',
      code,
      inputs: inputs.map((i) => ({
        ...i,
        dataType: i.dataType as 'string' | 'number' | 'boolean' | 'any',
      })),
      outputs: outputs.map((o) => ({
        ...o,
        dataType: o.dataType as 'string' | 'number' | 'boolean' | 'any',
      })),
    },
  }
}

describe('codeBlockGenerator', () => {
  describe('basic code generation', () => {
    it('generates function definition and call site', () => {
      const node = createCodeBlockNode('cb1', 'return 42')
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code).toHaveLength(4)
      expect(result.code[0]).toBe('local function _code_block_cb1()')
      expect(result.code[1]).toBe('  return 42')
      expect(result.code[2]).toBe('end')
      expect(result.code[3]).toBe('_code_block_cb1()')
    })

    it('wraps multi-line code with proper indentation', () => {
      const node = createCodeBlockNode(
        'cb1',
        'local x = 1\nlocal y = 2\nreturn x + y',
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      // Function def + 3 lines of code + end + call site = 6 lines
      expect(result.code).toHaveLength(6)
      expect(result.code[0]).toBe('local function _code_block_cb1()')
      expect(result.code[1]).toBe('  local x = 1')
      expect(result.code[2]).toBe('  local y = 2')
      expect(result.code[3]).toBe('  return x + y')
      expect(result.code[4]).toBe('end')
      expect(result.code[5]).toBe('_code_block_cb1()')
    })
  })

  describe('input port handling', () => {
    it('generates function parameters from input ports', () => {
      const node = createCodeBlockNode('cb1', 'return x + y', [
        { id: 'in1', name: 'x', dataType: 'number' },
        { id: 'in2', name: 'y', dataType: 'number' },
      ])
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[0]).toBe('local function _code_block_cb1(x, y)')
      expect(result.code[result.code.length - 1]).toBe('_code_block_cb1(x, y)')
    })

    it('sanitizes input port names', () => {
      const node = createCodeBlockNode('cb1', 'return user_name', [
        { id: 'in1', name: 'user-name', dataType: 'string' },
        { id: 'in2', name: '123data', dataType: 'number' },
      ])
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'local function _code_block_cb1(user_name, _123data)',
      )
      expect(result.code[result.code.length - 1]).toBe(
        '_code_block_cb1(user_name, _123data)',
      )
    })

    it('handles reserved words by prefixing with underscore', () => {
      const node = createCodeBlockNode('cb1', 'return end_val', [
        { id: 'in1', name: 'end', dataType: 'number' },
        { id: 'in2', name: 'function', dataType: 'string' },
      ])
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'local function _code_block_cb1(_end, _function)',
      )
      // Should emit warning about reserved words
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-block-reserved-word-ports',
          severity: 'warning',
        }),
      )
    })

    it('resolves connected input bindings', () => {
      const node = createCodeBlockNode('cb1', 'return x', [
        { id: 'in1', name: 'x', dataType: 'number' },
      ])
      const context = createMockContext({
        inputBindings: { in1: '_some_var' },
      })

      const result = codeBlockGenerator.generate(node, context)

      // The binding should be in inputBindings
      expect(result.inputBindings['in1']).toBe('_some_var')
    })
  })

  describe('output port handling', () => {
    it('captures single output as local variable', () => {
      const node = createCodeBlockNode(
        'cb1',
        'return result',
        [],
        [{ id: 'out1', name: 'result', dataType: 'string' }],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe(
        'local result = _code_block_cb1()',
      )
      expect(result.localVars).toContain('result')
    })

    it('captures multiple outputs with multiple assignment', () => {
      const node = createCodeBlockNode(
        'cb1',
        'return x, y',
        [],
        [
          { id: 'out1', name: 'x', dataType: 'number' },
          { id: 'out2', name: 'y', dataType: 'number' },
        ],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe(
        'local x, y = _code_block_cb1()',
      )
      expect(result.localVars).toEqual(['x', 'y'])
    })

    it('handles no outputs (procedure style)', () => {
      const node = createCodeBlockNode('cb1', 'print("hello")', [], [])
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe('_code_block_cb1()')
      expect(result.localVars).toEqual([])
    })

    it('sanitizes output port names', () => {
      const node = createCodeBlockNode(
        'cb1',
        'return my_var',
        [],
        [{ id: 'out1', name: 'my-var', dataType: 'number' }],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[result.code.length - 1]).toBe(
        'local my_var = _code_block_cb1()',
      )
    })
  })

  describe('validation', () => {
    it('emits error for empty code', () => {
      const node = createCodeBlockNode('cb1', '   ', [], [])
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-block-empty-code',
          severity: 'error',
        }),
      )
    })

    it('emits error for duplicate port names', () => {
      const node = createCodeBlockNode(
        'cb1',
        'return x',
        [
          { id: 'in1', name: 'x', dataType: 'number' },
          { id: 'in2', name: 'X', dataType: 'number' }, // Duplicate (case-insensitive)
        ],
        [],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code).toEqual([])
      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-block-duplicate-port-names',
          severity: 'error',
        }),
      )
    })

    it('emits warning for unclosed blocks', () => {
      const node = createCodeBlockNode(
        'cb1',
        'if true then\n  print("hello")',
        [],
        [],
      )
      const context = createMockContext()

      codeBlockGenerator.generate(node, context)

      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-block-mismatched-keywords',
          severity: 'warning',
        }),
      )
    })

    it('does not warn for keywords in a level-0 long-bracket literal', () => {
      const node = createCodeBlockNode(
        'cb1',
        [
          'vim.cmd [[',
          '  function MyTabLine()',
          '    for i in range(tabpagenr("$"))',
          '      if i == 1',
          '      endif',
          '    endfor',
          '  endfunction',
          ']]',
          'vim.opt.showtabline = 2',
        ].join('\n'),
      )
      const context = createMockContext()

      codeBlockGenerator.generate(node, context)

      const calls = (context.emitDiagnostic as ReturnType<typeof vi.fn>).mock
        .calls
      expect(
        calls.some((call) => call[0].id === 'code-block-mismatched-keywords'),
      ).toBe(false)
    })

    it.each([
      'local marker = "[["\nif ready then\n]]',
      '-- [[ marker\nif ready then\n]]',
      '--[=[x]=] if ready then',
    ])('warns when an opener shape must not hide an unclosed block', (code) => {
      const node = createCodeBlockNode('cb1', code)
      const context = createMockContext()

      codeBlockGenerator.generate(node, context)

      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'code-block-mismatched-keywords' }),
      )
    })

    it('emits warning when outputs expected but no return statement', () => {
      const node = createCodeBlockNode(
        'cb1',
        'print("hello")',
        [],
        [{ id: 'out1', name: 'result', dataType: 'string' }],
      )
      const context = createMockContext()

      codeBlockGenerator.generate(node, context)

      expect(context.emitDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-block-missing-return',
          severity: 'warning',
        }),
      )
    })

    it('does not emit missing return warning when no outputs', () => {
      const node = createCodeBlockNode('cb1', 'print("hello")', [], [])
      const context = createMockContext()

      codeBlockGenerator.generate(node, context)

      const calls = (context.emitDiagnostic as ReturnType<typeof vi.fn>).mock
        .calls
      const missingReturnCalls = calls.filter(
        (call) => call[0].id === 'code-block-missing-return',
      )
      expect(missingReturnCalls).toHaveLength(0)
    })
  })

  describe('collision resolution', () => {
    it('handles port name collisions with suffixes', () => {
      // my-input and my_input both sanitize to my_input
      const node = createCodeBlockNode(
        'cb1',
        'return my_input + my_input_2',
        [
          { id: 'in1', name: 'my-input', dataType: 'number' },
          { id: 'in2', name: 'my_input', dataType: 'number' },
        ],
        [],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'local function _code_block_cb1(my_input, my_input_2)',
      )
    })

    it('handles multiple empty port names', () => {
      const node = createCodeBlockNode(
        'cb1',
        'return _unnamed + _unnamed_2',
        [
          { id: 'in1', name: '', dataType: 'number' },
          { id: 'in2', name: '   ', dataType: 'number' },
        ],
        [],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code.length).toBeGreaterThan(0)
      expect(result.code[0]).toBe(
        'local function _code_block_cb1(_unnamed, _unnamed_2)',
      )
    })
  })

  describe('integration', () => {
    it('generates complete example from contract', () => {
      const code = `local name = user_name or "Guest"
if age >= 18 then
  return "Hello " .. name .. " (adult)"
else
  return "Hello " .. name .. " (minor)"
end`

      const node = createCodeBlockNode(
        'abc123',
        code,
        [
          { id: 'in1', name: 'user-name', dataType: 'string' },
          { id: 'in2', name: 'age', dataType: 'number' },
        ],
        [{ id: 'out1', name: 'greeting', dataType: 'string' }],
      )
      const context = createMockContext()

      const result = codeBlockGenerator.generate(node, context)

      expect(result.code[0]).toBe(
        'local function _code_block_abc123(user_name, age)',
      )
      expect(result.code[1]).toBe('  local name = user_name or "Guest"')
      expect(result.code[2]).toBe('  if age >= 18 then')
      expect(result.code[3]).toBe('    return "Hello " .. name .. " (adult)"')
      expect(result.code[4]).toBe('  else')
      expect(result.code[5]).toBe('    return "Hello " .. name .. " (minor)"')
      expect(result.code[6]).toBe('  end')
      expect(result.code[7]).toBe('end')
      expect(result.code[8]).toBe(
        'local greeting = _code_block_abc123(user_name, age)',
      )
    })
  })
})
