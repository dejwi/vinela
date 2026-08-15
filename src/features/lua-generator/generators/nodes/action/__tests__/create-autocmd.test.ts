// src/features/lua-generator/generators/nodes/action/__tests__/create-autocmd.test.ts
// Tests for create-autocmd action node generator

import { describe, expect, it } from 'vitest'
import { expectedAutocmdCallbackRef } from '@/features/lua-generator/__tests__/utils/callable-keys'
import { formatCallableId } from '@/features/lua-generator/lua-utils'
import { NEOVIM_EVENT_CATALOG } from '@/shared/data/neovim'
import type {
  ActionNodeDataFor,
  CreateAutocmdActionConfig,
  GraphEdge,
  GraphNode,
} from '@/shared/types'
import type { GenerationContext } from '../../types'
import { generateCreateAutocmd } from '../create-autocmd'

const DEFAULT_CALLBACK_NODE_ID = 'callback-action'

function createDefaultCallbackNode(): GraphNode<
  ActionNodeDataFor<'run-action'>
> {
  return {
    id: DEFAULT_CALLBACK_NODE_ID,
    type: 'action',
    definitionId: 'action-run-action',
    position: { x: 200, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'run-action',
      label: 'Run Action',
      displayName: 'Run Action',
      actionConfig: {
        actionConfigType: 'run-action',
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo callback',
        selectedActionKey: '',
        paramValues: {},
      },
    },
  }
}

function createDefaultCallbackEdge(
  targetId: string = DEFAULT_CALLBACK_NODE_ID,
): GraphEdge {
  return {
    id: 'edge-on-event-callback',
    source: 'test-node',
    sourcePort: 'on-event',
    target: targetId,
    targetPort: 'exec',
  }
}

/**
 * Create a minimal GenerationContext for testing.
 */
function createTestContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  const callbackNode = createDefaultCallbackNode()

  return {
    graphId: 'test-graph',
    graphName: 'Test Graph',
    nodeById: new Map([[callbackNode.id, callbackNode]]),
    edges: [createDefaultCallbackEdge()],
    inputBindings: {},
    outputBindingHints: {},
    indentLevel: 0,
    renderExecFromPort: (nodeId, sourcePortId) => {
      if (nodeId === 'test-node' && sourcePortId === 'on-event') {
        return ['vim.cmd("echo callback")']
      }
      return []
    },
    sanitizeIdentifier: (raw) => raw.replace(/[^a-zA-Z0-9_]/g, '_'),
    toLuaLiteral: (value) => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'number') return String(value)
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (Array.isArray(value)) {
        const items = value.map((v) => {
          if (typeof v === 'string') return `"${v}"`
          return String(v)
        })
        return `{ ${items.join(', ')} }`
      }
      return 'nil'
    },
    emitDiagnostic: () => {},
    callableSymbolByGraphId: new Map(),
    callableKeyByGraphId: new Map([
      ['test-graph', formatCallableId('Test Graph', 'test-graph')],
    ]),
    getVariableName: (hint = 'var') => `_${hint}`,
    ...overrides,
  }
}

/**
 * Config partial type for testing.
 */
type TestConfig = Partial<CreateAutocmdActionConfig>

/**
 * Create a test node for create-autocmd.
 */
function createTestNode(
  config: TestConfig = {},
): GraphNode<ActionNodeDataFor<'create-autocmd'>> {
  return {
    id: 'test-node',
    type: 'action',
    definitionId: 'action-create-autocmd',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      displayName: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: config.events ?? ['BufEnter'],
        patterns: config.patterns ?? ['*'],
        callbackLua: config.callbackLua ?? '',
        groupName: config.groupName ?? '',
        once: config.once ?? false,
        nested: config.nested ?? false,
      },
    },
  }
}

describe('generateCreateAutocmd', () => {
  describe('callback generation', () => {
    it('generates autocmd with inline callback for simple action', () => {
      const node = createTestNode({ events: ['BufEnter'] })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain(
        'callback = function() vim.cmd("echo callback") end',
      )
    })

    it('generates autocmd with callable reference for complex callback', () => {
      const complexCallbackNode: GraphNode = {
        id: 'callback-condition',
        type: 'condition',
        definitionId: 'condition-if',
        position: { x: 240, y: 0 },
        data: {
          nodeType: 'condition',
          operator: '==',
          hardcodedA: 'a',
          hardcodedB: 'b',
        },
      }

      const node = createTestNode({ events: ['BufEnter'] })
      const context = createTestContext({
        nodeById: new Map([[complexCallbackNode.id, complexCallbackNode]]),
        edges: [createDefaultCallbackEdge(complexCallbackNode.id)],
        renderExecFromPort: () => ['if ready then', 'do_work()', 'end'],
      })
      const result = generateCreateAutocmd(node, context)

      const rendered = result.code.join('\n')
      const callbackRef = expectedAutocmdCallbackRef('Test Graph', 'test-node')
      expect(rendered).toContain(`${callbackRef} = function()`)
      expect(rendered).toContain(callbackRef)
      expect(rendered).toContain(`callback = ${callbackRef}`)
    })

    it('emits error when no callback connected', () => {
      const diagnostics: Array<{
        id: string
        severity: string
        message: string
      }> = []

      const node = createTestNode({ events: ['BufEnter'] })
      const context = createTestContext({
        nodeById: new Map(),
        edges: [],
        renderExecFromPort: () => [],
        emitDiagnostic: (d) =>
          diagnostics.push({
            id: d.id,
            severity: d.severity,
            message: d.message,
          }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics.some((d) => d.id === 'ERR_AUTOCMD_NO_CALLBACK')).toBe(
        true,
      )
      expect(diagnostics.some((d) => d.severity === 'error')).toBe(true)
    })
  })

  describe('basic event registration', () => {
    it('generates simple autocmd with single event', () => {
      const node = createTestNode({ events: ['BufEnter'] })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('vim.api.nvim_create_autocmd')
      expect(result.code[0]).toContain('"BufEnter"')
      expect(result.code[0]).toContain('pattern')
    })

    it('generates autocmd with multiple events', () => {
      const node = createTestNode({ events: ['BufEnter', 'BufLeave'] })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('vim.api.nvim_create_autocmd')
      expect(result.code[0]).toContain('{ "BufEnter", "BufLeave" }')
    })

    it('accepts DirChanged as a valid event', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: ['DirChanged'] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('"DirChanged"')
      expect(
        diagnostics.some((d) => d.message.includes('Invalid autocmd event')),
      ).toBe(false)
    })

    it('accepts Progress/PackChanged/PackChangedPre as valid events', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({
        events: ['Progress', 'PackChanged', 'PackChangedPre'],
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain(
        '{ "Progress", "PackChanged", "PackChangedPre" }',
      )
      expect(
        diagnostics.some((d) => d.message.includes('Invalid autocmd event')),
      ).toBe(false)
    })

    it('canonicalizes lowercase known events before emitting Lua', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: ['bufenter'] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('"BufEnter"')
      expect(
        diagnostics.some((d) => d.message.includes('Invalid autocmd event')),
      ).toBe(false)
    })

    it('accepts every catalog event as a valid generator event', () => {
      for (const catalogEvent of NEOVIM_EVENT_CATALOG) {
        const diagnostics: Array<{
          severity: string
          message: string
        }> = []
        const node = createTestNode({ events: [catalogEvent.name] })
        const context = createTestContext({
          emitDiagnostic: (d) =>
            diagnostics.push({ severity: d.severity, message: d.message }),
        })
        const result = generateCreateAutocmd(node, context)

        expect(result.code).toHaveLength(1)
        expect(result.code[0]).toContain(`"${catalogEvent.name}"`)
        expect(
          diagnostics.some((d) => d.message.includes('Invalid autocmd event')),
        ).toBe(false)
      }
    })

    it('accepts canonical User* events', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: ['UserMyEvent'] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(1)
      expect(result.code[0]).toContain('"UserMyEvent"')
      expect(
        diagnostics.some((d) => d.message.includes('Invalid autocmd event')),
      ).toBe(false)
    })

    it('rejects non-canonical lowercase user* events', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: ['BufEnter', 'userMyEvent'] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })

      generateCreateAutocmd(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('Invalid autocmd event')
      expect(warning?.message).toContain('userMyEvent')
    })
  })

  describe('pattern handling', () => {
    it('uses default pattern when none provided', () => {
      const node = createTestNode({ events: ['BufEnter'], patterns: [] })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('pattern = "*"')
    })

    it('uses provided single pattern', () => {
      const node = createTestNode({
        events: ['BufEnter'],
        patterns: ['*.lua'],
      })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('pattern = "*.lua"')
    })

    it('uses multiple patterns as array', () => {
      const node = createTestNode({
        events: ['BufEnter'],
        patterns: ['*.lua', '*.vim'],
      })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('pattern = { "*.lua", "*.vim" }')
    })
  })

  describe('optional flags', () => {
    it('includes once flag when enabled', () => {
      const node = createTestNode({ events: ['BufEnter'], once: true })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('once = true')
    })

    it('includes nested flag when enabled', () => {
      const node = createTestNode({ events: ['BufEnter'], nested: true })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('nested = true')
    })

    it('includes both flags when enabled', () => {
      const node = createTestNode({
        events: ['BufEnter'],
        once: true,
        nested: true,
      })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('once = true')
      expect(result.code[0]).toContain('nested = true')
    })

    it('omits flags when disabled', () => {
      const node = createTestNode({ events: ['BufEnter'], once: false })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).not.toContain('once')
    })
  })

  describe('group name', () => {
    it('includes group when provided', () => {
      const node = createTestNode({
        events: ['BufEnter'],
        groupName: 'MyAutocmds',
      })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).toContain('group = "MyAutocmds"')
    })

    it('omits group when empty', () => {
      const node = createTestNode({ events: ['BufEnter'], groupName: '' })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.code[0]).not.toContain('group')
    })
  })

  describe('validation', () => {
    it('returns empty unit when no valid events', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: [] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('no events selected')
    })

    it('returns empty unit when events are whitespace-only', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: ['   ', '\t'] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      const result = generateCreateAutocmd(node, context)

      expect(result.code).toHaveLength(0)
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]?.severity).toBe('error')
      expect(diagnostics[0]?.message).toContain('no events selected')
    })

    it('warns about invalid events', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({ events: ['BufEnter', 'InvalidEvent'] })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      generateCreateAutocmd(node, context)

      const warning = diagnostics.find((d) => d.severity === 'warning')
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('Invalid autocmd event')
    })

    it('warns about legacy callbackLua', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({
        events: ['BufEnter'],
        callbackLua: 'print("hello")',
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      generateCreateAutocmd(node, context)

      const warning = diagnostics.find((d) => d.message.includes('Legacy'))
      expect(warning).toBeDefined()
      expect(warning?.severity).toBe('warning')
    })

    it('warns about home directory in patterns', () => {
      const diagnostics: Array<{
        severity: string
        message: string
      }> = []
      const node = createTestNode({
        events: ['BufEnter'],
        patterns: ['~/.config/nvim/*.lua'],
      })
      const context = createTestContext({
        emitDiagnostic: (d) =>
          diagnostics.push({ severity: d.severity, message: d.message }),
      })
      generateCreateAutocmd(node, context)

      const warning = diagnostics.find((d) =>
        d.message.includes('home directory'),
      )
      expect(warning).toBeDefined()
      expect(warning?.severity).toBe('warning')
    })
  })

  describe('output bindings', () => {
    it('provides done output binding', () => {
      const node = createTestNode({ events: ['BufEnter'] })
      const context = createTestContext()
      const result = generateCreateAutocmd(node, context)

      expect(result.outputBindings['done']).toBe('nil')
    })
  })
})
