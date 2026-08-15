import { describe, expect, it } from 'vitest'
import type { GraphNode } from '@/shared/types'
import {
  generatePluginActionCode,
  isLegacyPluginActionData,
  isPluginActionNode,
} from '../../advanced/plugin-action'
import { createMockContext } from '../helpers/mock-context'

function createLegacyPluginActionNode(
  data: Record<string, unknown>,
  id = 'legacy-plugin-action',
): GraphNode {
  return {
    id,
    type: 'action',
    definitionId: 'plugin-action-legacy',
    position: { x: 0, y: 0 },
    data,
  } as unknown as GraphNode
}

const deprecationSuggestions = [
  'Delete this node and configure the plugin in the Plugins panel instead',
  'For plugin function calls, use a "run-function" node',
  'For custom Lua code, use a "code-block" node',
]

describe('plugin-action legacy generator', () => {
  describe('isLegacyPluginActionData', () => {
    it('accepts legacy plugin-action node data', () => {
      expect(
        isLegacyPluginActionData({
          nodeType: 'plugin-action',
          pluginId: 'example',
          displayName: 'Example Plugin',
        }),
      ).toBe(true)
    })

    it('accepts malformed legacy labels while preserving identity', () => {
      expect(
        isLegacyPluginActionData({
          nodeType: 'plugin-action',
          displayName: 42,
          pluginId: {},
        }),
      ).toBe(true)
    })

    it('rejects non-legacy node data', () => {
      expect(isLegacyPluginActionData({ nodeType: 'action' })).toBe(false)
      expect(isLegacyPluginActionData(null)).toBe(false)
      expect(isLegacyPluginActionData('plugin-action')).toBe(false)
      expect(
        isLegacyPluginActionData({ nodeType: 'plugin-action-lookalike' }),
      ).toBe(false)
    })
  })

  describe('isPluginActionNode', () => {
    it('routes only legacy plugin-action nodes', () => {
      expect(
        isPluginActionNode(
          createLegacyPluginActionNode({ nodeType: 'plugin-action' }),
        ),
      ).toBe(true)
      expect(
        isPluginActionNode(
          createLegacyPluginActionNode({ nodeType: 'run-function' }),
        ),
      ).toBe(false)
    })
  })

  describe('generatePluginActionCode', () => {
    it('emits a complete diagnostic and empty unit for valid legacy data', () => {
      const node = createLegacyPluginActionNode({
        nodeType: 'plugin-action',
        displayName: '  My Plugin  ',
        pluginId: 'fallback-id',
      })
      const { context, getEmittedDiagnostics } = createMockContext({
        graphId: 'graph-1',
      })

      const unit = generatePluginActionCode(node, context)

      expect(unit).toEqual({
        nodeId: 'legacy-plugin-action',
        nodeType: 'plugin-action',
        code: [],
        localVars: [],
        inputBindings: {},
        outputBindings: {},
        indentLevel: 0,
      })
      expect(getEmittedDiagnostics()).toEqual([
        {
          id: 'plugin-action-deprecated',
          severity: 'error',
          category: 'config',
          message: "Node 'My Plugin' uses deprecated plugin-action type",
          details:
            "Node 'legacy-plugin-action' uses the deprecated 'plugin-action' node type. " +
            'PluginAction nodes are no longer supported. ' +
            'Please delete this node and re-create the configuration in the Plugin section ' +
            "or use a 'run-function' node for plugin-specific actions.",
          source: {
            graphId: 'graph-1',
            nodeId: 'legacy-plugin-action',
            nodeType: 'plugin-action',
          },
          suggestions: deprecationSuggestions,
        },
      ])
    })

    it('never throws for malformed labels and uses unnamed in the diagnostic', () => {
      const node = createLegacyPluginActionNode(
        {
          nodeType: 'plugin-action',
          displayName: 42,
          pluginId: {},
        },
        'legacy-malformed',
      )
      const { context, getEmittedDiagnostics } = createMockContext({
        graphId: 'graph-1',
      })

      const unit = generatePluginActionCode(node, context)

      expect(unit).toEqual({
        nodeId: 'legacy-malformed',
        nodeType: 'plugin-action',
        code: [],
        localVars: [],
        inputBindings: {},
        outputBindings: {},
        indentLevel: 0,
      })
      expect(getEmittedDiagnostics()).toEqual([
        {
          id: 'plugin-action-deprecated',
          severity: 'error',
          category: 'config',
          message: "Node 'unnamed' uses deprecated plugin-action type",
          details:
            "Node 'legacy-malformed' uses the deprecated 'plugin-action' node type. " +
            'PluginAction nodes are no longer supported. ' +
            'Please delete this node and re-create the configuration in the Plugin section ' +
            "or use a 'run-function' node for plugin-specific actions.",
          source: {
            graphId: 'graph-1',
            nodeId: 'legacy-malformed',
            nodeType: 'plugin-action',
          },
          suggestions: deprecationSuggestions,
        },
      ])
    })

    it('falls back to valid pluginId when displayName is malformed', () => {
      const node = createLegacyPluginActionNode({
        nodeType: 'plugin-action',
        displayName: 42,
        pluginId: 'valid-plugin-id',
      })
      const { context, getEmittedDiagnostics } = createMockContext()

      generatePluginActionCode(node, context)

      expect(getEmittedDiagnostics()[0]?.message).toBe(
        "Node 'valid-plugin-id' uses deprecated plugin-action type",
      )
    })

    it('falls back to pluginId then unnamed for whitespace-only displayName', () => {
      const node = createLegacyPluginActionNode({
        nodeType: 'plugin-action',
        pluginId: 'only-plugin-id',
        displayName: '   ',
      })
      const { context, getEmittedDiagnostics } = createMockContext()

      generatePluginActionCode(node, context)

      expect(getEmittedDiagnostics()[0]?.message).toBe(
        "Node 'only-plugin-id' uses deprecated plugin-action type",
      )
    })

    it('uses unnamed when legacy data is missing labels', () => {
      const node = createLegacyPluginActionNode({ nodeType: 'plugin-action' })
      const { context, getEmittedDiagnostics } = createMockContext()

      generatePluginActionCode(node, context)

      expect(getEmittedDiagnostics()[0]?.message).toBe(
        "Node 'unnamed' uses deprecated plugin-action type",
      )
    })
  })
})
