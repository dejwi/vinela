// Tests for Set Keymap Action Node Generator

import { describe, expect, it } from 'vitest'
import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import type { GenerationDiagnostic } from '../../../../diagnostics/types'
import type { GenerationContext } from '../../types'
import { generateSetKeymap } from '../set-keymap'

function createMockNode(
  modes: string[],
  keySequence: string,
  command: string,
  options: Partial<ActionNodeDataFor<'set-keymap'>['actionConfig']> = {},
): GraphNode<ActionNodeDataFor<'set-keymap'>> {
  return {
    id: 'test-node-1',
    type: 'action',
    definitionId: 'action:set-keymap',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'set-keymap',
      label: 'Set Keymap',
      actionConfig: {
        actionConfigType: 'set-keymap',
        modes: modes as ('n' | 'i' | 'v' | 'x' | 't' | 'c' | 'o' | 's')[],
        keySequence,
        command,
        description: options.description ?? '',
        silent: options.silent ?? true,
        noremap: options.noremap ?? true,
        expr: options.expr ?? false,
        showInKeymaps: options.showInKeymaps ?? true,
      },
    },
  }
}

function createMockContext(
  inputBindings: Record<string, string> = {},
): GenerationContext {
  const diagnostics: GenerationDiagnostic[] = []

  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map(),
    edges: [],
    inputBindings,
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: () => [],
    sanitizeIdentifier: (s): string => s.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (v): string => (typeof v === 'string' ? `"${v}"` : String(v)),
    emitDiagnostic: (d): number => diagnostics.push(d),
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint): string => `_${hint ?? 'var'}`,
  }
}

describe('generateSetKeymap', () => {
  describe('happy path', () => {
    it('generates simple keymap with single mode', () => {
      const node = createMockNode(['n'], '<leader>f', ':vsplit<CR>')
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('vim.keymap.set')
      expect(result.code[0]).toContain('"n"')
      expect(result.code[0]).toContain('"<leader>f"')
      expect(result.code[0]).toContain('":vsplit<CR>"')
    })

    it('generates keymap with multiple modes', () => {
      const node = createMockNode(
        ['n', 'v'],
        'gd',
        ':lua vim.lsp.buf.definition()<CR>',
      )
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      expect(result.code[0]).toContain('vim.keymap.set')
      expect(result.code[0]).toContain('{"n", "v"}')
    })

    it('includes options table', () => {
      const node = createMockNode(['n'], '<leader>x', ':echo "test"<CR>', {
        silent: true,
        noremap: true,
        description: 'Test mapping',
      })
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      expect(result.code[0]).toContain('silent = true')
      expect(result.code[0]).toContain('remap = false')
      expect(result.code[0]).toContain('desc = "Test mapping"')
    })

    it('handles expr option', () => {
      const node = createMockNode(['i'], '<Tab>', '...', { expr: true })
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      expect(result.code[0]).toContain('expr = true')
    })

    it('uses connected key-sequence input over config', () => {
      const node = createMockNode(['n'], '<leader>x', ':echo "config"<CR>')
      const context = createMockContext({ 'key-sequence': '<F5>' })

      const result = generateSetKeymap(node, context)

      expect(result.code[0]).toContain('"<F5>"')
    })

    it('uses connected on-press input over config', () => {
      const node = createMockNode(['n'], '<leader>x', ':echo "config"<CR>')
      const context = createMockContext({ 'on-press': 'myFunction' })

      const result = generateSetKeymap(node, context)

      expect(result.code[0]).toContain('myFunction')
    })
  })

  describe('config validation', () => {
    it('emits error for empty key sequence', () => {
      const node = createMockNode(['n'], '', ':echo "test"<CR>')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetKeymap(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('key sequence')
    })

    it('emits error for empty command', () => {
      const node = createMockNode(['n'], '<leader>x', '')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetKeymap(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.message).toContain('command')
    })

    it('emits error for empty modes', () => {
      const node = createMockNode([], '<leader>x', ':echo "test"<CR>')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateSetKeymap(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.message).toContain('mode')
    })
  })

  describe('escaping', () => {
    it('escapes quotes in key sequence', () => {
      const node = createMockNode(['n'], '"test"', ':echo "test"<CR>')
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      // The output contains escaped quotes: \"test\"
      expect(result.code[0]).toContain('\\"test\\"')
    })

    it('handles special key notation', () => {
      const node = createMockNode(['n'], '<C-c>', ':echo "ctrl-c"<CR>')
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      expect(result.code[0]).toContain('"<C-c>"')
    })
  })

  describe('output structure', () => {
    it('returns correct CompilationUnit structure', () => {
      const node = createMockNode(['n'], '<leader>f', ':Files<CR>')
      const context = createMockContext()

      const result = generateSetKeymap(node, context)

      expect(result.nodeId).toBe('test-node-1')
      expect(result.nodeType).toBe('action:set-keymap')
      expect(result.localVars).toHaveLength(0)
      expect(result.outputBindings).toEqual({})
    })
  })
})
