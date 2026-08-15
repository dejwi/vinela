// src/features/lua-generator/generators/nodes/action/__tests__/set-highlight.test.ts
// Tests for set-highlight action node generator

import { describe, expect, it } from 'vitest'
import type {
  ActionNodeDataFor,
  GraphNode,
  SetHighlightActionConfig,
} from '@/shared/types'
import type { GenerationContext } from '../../types'
import { generateSetHighlight } from '../set-highlight'

/**
 * Create a minimal GenerationContext for testing.
 */
function createTestContext(
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
    renderExecFromPort: () => [],
    sanitizeIdentifier: (raw) => raw.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (value) => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'number') return String(value)
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      return 'nil'
    },
    emitDiagnostic: () => {},
    callableSymbolByGraphId: new Map(),
    getVariableName: (hint = 'var') => `_${hint}`,
    ...overrides,
  }
}

/**
 * Config partial type for testing.
 */
type TestConfig = Partial<SetHighlightActionConfig>

/**
 * Create a test node for set-highlight.
 */
function createTestNode(
  config: TestConfig = {},
): GraphNode<ActionNodeDataFor<'set-highlight'>> {
  return {
    id: 'test-node',
    type: 'action',
    definitionId: 'action-set-highlight',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'set-highlight',
      label: 'Set Highlight',
      displayName: 'Set Highlight',
      actionConfig: {
        actionConfigType: 'set-highlight',
        groupName: config.groupName ?? 'Normal',
        foreground: config.foreground ?? '',
        background: config.background ?? '',
        bold: config.bold ?? false,
        italic: config.italic ?? false,
        underline: config.underline ?? false,
      },
    },
  }
}

describe('generateSetHighlight', () => {
  describe('color generation', () => {
    it('generates highlight with foreground color', () => {
      const node = createTestNode({
        groupName: 'Normal',
        foreground: '#ffffff',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code).toHaveLength(2)
      expect(result.code[0]).toContain('pcall')
      expect(result.code[0]).toContain('nvim_get_hl')
      expect(result.code[1]).toContain('nvim_set_hl')
      expect(result.code[1]).toContain('Normal')
      expect(result.code[1]).toContain('fg = "#ffffff"')
    })

    it('generates highlight with background color', () => {
      const node = createTestNode({
        groupName: 'Normal',
        background: '#000000',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('bg = "#000000"')
    })

    it('generates highlight with both colors', () => {
      const node = createTestNode({
        groupName: 'Comment',
        foreground: '#808080',
        background: '#1a1a1a',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('fg = "#808080"')
      expect(result.code[1]).toContain('bg = "#1a1a1a"')
    })
  })

  describe('style generation', () => {
    it('generates highlight with bold style', () => {
      const node = createTestNode({
        groupName: 'Keyword',
        foreground: '#ff0000',
        bold: true,
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('bold = true')
    })

    it('generates highlight with italic style', () => {
      const node = createTestNode({
        groupName: 'Comment',
        foreground: '#808080',
        italic: true,
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('italic = true')
    })

    it('generates highlight with underline style', () => {
      const node = createTestNode({
        groupName: 'Underlined',
        foreground: '#00ff00',
        underline: true,
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('underline = true')
    })

    it('generates highlight with multiple styles', () => {
      const node = createTestNode({
        groupName: 'Title',
        foreground: '#ffff00',
        bold: true,
        italic: true,
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('bold = true')
      expect(result.code[1]).toContain('italic = true')
    })
  })

  describe('merge semantics', () => {
    it('uses pcall to fetch existing highlight', () => {
      const node = createTestNode({
        groupName: 'Normal',
        foreground: '#ffffff',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[0]).toContain('pcall')
      expect(result.code[0]).toContain('nvim_get_hl')
      expect(result.code[0]).toContain('link = false')
    })

    it('uses vim.tbl_extend for merging', () => {
      const node = createTestNode({
        groupName: 'Normal',
        foreground: '#ffffff',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[1]).toContain('vim.tbl_extend')
      expect(result.code[1]).toContain('"force"')
    })

    it('handles special characters in group names', () => {
      const node = createTestNode({
        groupName: '@lsp.type.function',
        foreground: '#ffffff',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.code[0]).toContain('_existing__lsp_type_function')
    })
  })

  describe('validation', () => {
    it('returns empty unit when group name is empty', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({ groupName: '' })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateSetHighlight(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain(
        'requires a highlight group name',
      )
    })

    it('returns empty unit when no attributes provided', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        groupName: 'Normal',
        foreground: '',
        background: '',
        bold: false,
        italic: false,
        underline: false,
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateSetHighlight(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('warning')
    })

    it('warns about invalid foreground color', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        groupName: 'Normal',
        foreground: 'not-a-color',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      generateSetHighlight(node, context)

      const warning = diagnostics.find((d) =>
        d.message.includes('Foreground color'),
      )
      expect(warning).toBeDefined()
      expect(warning?.severity).toBe('warning')
    })

    it('warns about invalid background color', () => {
      const diagnostics: Array<{ severity: string; message: string }> = []
      const node = createTestNode({
        groupName: 'Normal',
        background: 'also-not-a-color',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      generateSetHighlight(node, context)

      const warning = diagnostics.find((d) =>
        d.message.includes('Background color'),
      )
      expect(warning).toBeDefined()
      expect(warning?.severity).toBe('warning')
    })
  })

  describe('output bindings', () => {
    it('provides done output binding', () => {
      const node = createTestNode({
        groupName: 'Normal',
        foreground: '#ffffff',
      })
      const context = createTestContext()
      const result = generateSetHighlight(node, context)

      expect(result.outputBindings['done']).toBe('nil')
    })
  })
})
