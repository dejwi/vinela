// Tests for Set Option Action Node Generator

import { describe, expect, it } from 'vitest'
import type {
  ActionNodeDataFor,
  GraphNode,
  SetOptionValueConfig,
} from '@/shared/types'
import type { GenerationDiagnostic } from '../../../../diagnostics/types'
import type { GenerationContext } from '../../types'
import { generateSetOption } from '../set-option'

function createMockNode(
  optionName: string,
  scope: 'global' | 'local',
  valueConfig: SetOptionValueConfig,
): GraphNode<ActionNodeDataFor<'set-option'>> {
  return {
    id: 'test-node-1',
    type: 'action',
    definitionId: 'action:set-option',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'set-option',
      label: 'Set Option',
      actionConfig: {
        actionConfigType: 'set-option',
        optionName,
        scope,
        valueConfig,
      },
    },
  }
}

function createMockContext(
  inputBindings: Record<string, string> = {},
  toLuaLiteral = (v: unknown) => String(v),
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
    sanitizeIdentifier: (s) => s.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral,
    emitDiagnostic: (d) => diagnostics.push(d),
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint) => `_${hint ?? 'var'}`,
  }
}

describe('generateSetOption', () => {
  describe('happy path', () => {
    it('generates global scope option assignment', () => {
      const node = createMockNode('number', 'global', {
        valueMode: 'suggested',
        suggestedValue: true,
      })
      const context = createMockContext()

      const result = generateSetOption(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toBe('vim.opt.number = true')
    })

    it('generates local scope option assignment', () => {
      const node = createMockNode('number', 'local', {
        valueMode: 'suggested',
        suggestedValue: false,
      })
      const context = createMockContext()

      const result = generateSetOption(node, context)

      expect(result.code[0]).toBe('vim.opt_local.number = false')
    })

    it('generates string value assignment', () => {
      const node = createMockNode('shiftwidth', 'global', {
        valueMode: 'suggested',
        suggestedValue: 4,
      })
      const context = createMockContext()

      const result = generateSetOption(node, context)

      expect(result.code[0]).toBe('vim.opt.shiftwidth = 4')
    })

    it('generates raw Lua expression', () => {
      const node = createMockNode('background', 'global', {
        valueMode: 'raw',
        rawValue: '"dark"',
      })
      const context = createMockContext()

      const result = generateSetOption(node, context)

      expect(result.code[0]).toBe('vim.opt.background = "dark"')
    })

    it('uses connected input value over config', () => {
      const node = createMockNode('number', 'global', {
        valueMode: 'suggested',
        suggestedValue: true,
      })
      const context = createMockContext({ value: 'myVar' })

      const result = generateSetOption(node, context)

      expect(result.code[0]).toBe('vim.opt.number = myVar')
    })
  })

  describe('config validation', () => {
    it('emits error for missing option name', () => {
      const node = createMockNode('', 'global', {
        valueMode: 'suggested',
        suggestedValue: true,
      })
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d) => diagnostics.push(d),
      }

      const result = generateSetOption(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('option name')
    })

    it('emits error for whitespace-only option name', () => {
      const node = createMockNode('   ', 'global', {
        valueMode: 'suggested',
        suggestedValue: true,
      })
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d) => diagnostics.push(d),
      }

      const result = generateSetOption(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
    })

    it('emits error for missing value', () => {
      const node = createMockNode('number', 'global', {
        valueMode: 'raw',
        rawValue: '',
      })
      const diagnostics: GenerationDiagnostic[] = []
      const context: GenerationContext = {
        ...createMockContext(),
        emitDiagnostic: (d) => diagnostics.push(d),
      }

      const result = generateSetOption(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.message).toContain('no value')
    })
  })

  describe('escaping', () => {
    it('trims whitespace from option name', () => {
      const node = createMockNode('  relativenumber  ', 'global', {
        valueMode: 'suggested',
        suggestedValue: true,
      })
      const context = createMockContext()

      const result = generateSetOption(node, context)

      expect(result.code[0]).toBe('vim.opt.relativenumber = true')
    })

    it('preserves special characters in raw values', () => {
      const node = createMockNode('statusline', 'global', {
        valueMode: 'raw',
        rawValue: '"%f %y %m"',
      })
      const context = createMockContext()

      const result = generateSetOption(node, context)

      expect(result.code[0]).toBe('vim.opt.statusline = "%f %y %m"')
    })
  })

  describe('indentation', () => {
    it('preserves indent level in output', () => {
      const node = createMockNode('number', 'global', {
        valueMode: 'suggested',
        suggestedValue: true,
      })
      const context: GenerationContext = {
        ...createMockContext(),
        indentLevel: 2,
      }

      const result = generateSetOption(node, context)

      expect(result.indentLevel).toBe(2)
    })
  })
})
