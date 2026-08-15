// Tests for Run Command Action Node Generator

import { describe, expect, it } from 'vitest'
import type { ActionNodeDataFor, GraphNode } from '@/shared/types'
import type { GenerationDiagnostic } from '../../../../diagnostics/types'
import type { GenerationContext } from '../../types'
import { generateRunAction } from '../run-command'

function createMockNode(
  actionType: 'command' | 'keys',
  action: string,
): GraphNode<ActionNodeDataFor<'run-action'>> {
  return {
    id: 'test-node-1',
    type: 'action',
    definitionId: 'action:run-action',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'run-action',
      label: 'Run Action',
      actionConfig: {
        actionConfigType: 'run-action',
        mode: 'custom-command',
        actionType,
        action,
        selectedActionKey: '',
        paramValues: {},
      },
    },
  }
}

function createMockContext(): GenerationContext {
  const diagnostics: GenerationDiagnostic[] = []

  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map(),
    edges: [],
    inputBindings: {},
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: () => [],
    sanitizeIdentifier: (s): string => s.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (v): string => String(v),
    emitDiagnostic: (d): number => diagnostics.push(d),
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint): string => `_${hint ?? 'var'}`,
  }
}

describe('generateRunAction', () => {
  describe('command type', () => {
    it('generates vim.cmd for simple command', () => {
      const node = createMockNode('command', 'vsplit')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('vim.cmd("vsplit")')
    })

    it('strips leading colon from command', () => {
      const node = createMockNode('command', ':edit test.txt')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("edit test.txt")')
    })

    it('escapes quotes in command', () => {
      const node = createMockNode('command', 'echo "hello world"')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("echo \\"hello world\\"")')
    })

    it('escapes backslashes in command', () => {
      const node = createMockNode('command', 's/\\\\//g')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("s/\\\\\\\\//g")')
    })

    it('escapes newlines in command', () => {
      const node = createMockNode('command', 'line1\nline2')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("line1\\nline2")')
    })
  })

  describe('keys type', () => {
    it('generates nvim_feedkeys for key sequence', () => {
      const node = createMockNode('keys', '<CR>')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toContain('vim.api.nvim_feedkeys')
      expect(result.code[0]).toContain('vim.keycode')
      expect(result.code[0]).toContain('"<CR>"')
    })

    it('uses mode "m" for key sequences', () => {
      const node = createMockNode('keys', '<Esc>')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toContain('"m"')
      expect(result.code[0]).toContain('false')
    })

    it('escapes quotes in key sequence', () => {
      const node = createMockNode('keys', '"quoted"')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      // The output contains escaped quotes
      expect(result.code[0]).toContain('\\"quoted\\"')
    })

    it('handles complex key sequences', () => {
      const node = createMockNode('keys', '<C-w>v')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toContain('"<C-w>v"')
    })
  })

  describe('config validation', () => {
    it('emits error for empty command', () => {
      const node = createMockNode('command', '')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateRunAction(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('requires a command')
    })

    it('emits error for whitespace-only command', () => {
      const node = createMockNode('command', '   ')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateRunAction(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
    })

    it('emits warning for multiline command', () => {
      const node = createMockNode('command', 'echo "line1"\necho "line2"')
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d): number => diagnostics.push(d),
      }

      const result = generateRunAction(node, context)

      // Should still generate code
      expect(result.code).toHaveLength(1)
      // But emit a warning
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('warning')
      expect(diagnostics[0]?.message).toContain('newlines')
    })
  })

  describe('output structure', () => {
    it('returns correct CompilationUnit for command', () => {
      const node = createMockNode('command', 'write')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.nodeId).toBe('test-node-1')
      expect(result.nodeType).toBe('action:run-action')
      expect(result.localVars).toHaveLength(0)
      expect(result.outputBindings).toEqual({})
      expect(result.inputBindings).toEqual({})
    })

    it('returns correct CompilationUnit for keys', () => {
      const node = createMockNode('keys', '<Tab>')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.nodeId).toBe('test-node-1')
      expect(result.nodeType).toBe('action:run-action')
      expect(result.code[0]).toContain('nvim_feedkeys')
    })

    it('preserves indent level', () => {
      const node = createMockNode('command', 'quit')
      const context: GenerationContext = {
        ...createMockContext(),
        indentLevel: 3,
      }

      const result = generateRunAction(node, context)

      expect(result.indentLevel).toBe(3)
    })
  })

  describe('common commands', () => {
    it('handles write command', () => {
      const node = createMockNode('command', 'w')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("w")')
    })

    it('handles quit command', () => {
      const node = createMockNode('command', 'q')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("q")')
    })

    it('handles vsplit command', () => {
      const node = createMockNode('command', 'vsplit')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("vsplit")')
    })

    it('handles edit command with filename', () => {
      const node = createMockNode('command', 'edit /path/to/file.lua')
      const context = createMockContext()

      const result = generateRunAction(node, context)

      expect(result.code[0]).toBe('vim.cmd("edit /path/to/file.lua")')
    })
  })
})
