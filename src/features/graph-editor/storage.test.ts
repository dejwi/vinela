import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGraphFilePath } from '@/shared/lib/paths'
import type { Graph } from '@/shared/types'
import {
  listGraphs,
  saveGraphContent,
  updateGraphMetadata,
  updateGraphOrderBatch,
} from './storage'

const projectFileStore = new Map<string, unknown>()
const writeCalls: string[] = []

function toStorageKey(projectPath: string, relativePath: string): string {
  return `${projectPath}::${relativePath}`
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

vi.mock('@/shared/lib/storage-api', () => ({
  ensureProjectDir: vi.fn(async () => {}),
  listProjectDir: vi.fn(async (projectPath: string, relativePath: string) => {
    const prefix = `${projectPath}::${relativePath}/`
    const names = [...projectFileStore.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))

    return names.map((name) => ({
      name,
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }))
  }),
  readProjectFile: vi.fn(async (projectPath: string, relativePath: string) => {
    const key = toStorageKey(projectPath, relativePath)
    const value = projectFileStore.get(key)
    if (value === undefined) {
      throw new Error(`Missing file: ${key}`)
    }

    return cloneValue(value)
  }),
  writeProjectFile: vi.fn(
    async (projectPath: string, relativePath: string, data: unknown) => {
      writeCalls.push(relativePath)
      projectFileStore.set(
        toStorageKey(projectPath, relativePath),
        cloneValue(data),
      )
    },
  ),
  removeProjectFile: vi.fn(
    async (projectPath: string, relativePath: string) => {
      projectFileStore.delete(toStorageKey(projectPath, relativePath))
    },
  ),
}))

function createGraph(id: string, overrides: Partial<Graph> = {}): Graph {
  return {
    id,
    name: `Graph ${id}`,
    nodes: [],
    edges: [],
    createdAt: 1,
    updatedAt: 10,
    enabled: true,
    order: 0,
    ...overrides,
  }
}

describe('graph storage canonical format', () => {
  beforeEach(() => {
    projectFileStore.clear()
    writeCalls.length = 0
  })

  it('loads and sorts canonical graphs by order', async () => {
    const projectPath = '/project'

    const graphA = createGraph('a', {
      order: 0,
      updatedAt: 100,
      enabled: true,
    })
    const graphB = createGraph('b', {
      order: 1,
      updatedAt: 50,
      enabled: true,
    })

    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('a')),
      graphA,
    )
    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('b')),
      graphB,
    )

    const graphs = await listGraphs(projectPath)

    expect(graphs.map((graph) => graph.id)).toEqual(['a', 'b'])
    expect(graphs.map((graph) => graph.order)).toEqual([0, 1])
    expect(graphs.map((graph) => graph.enabled)).toEqual([true, true])

    // No migration writes in pre-production (canonical only)
    expect(writeCalls).toEqual([])
  })

  it('skips invalid graph files without writing', async () => {
    const projectPath = '/project'

    const validGraph = createGraph('valid', { order: 0 })
    const invalidGraph = { id: 'invalid', name: 'Invalid' } // Missing required fields

    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('valid')),
      validGraph,
    )
    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('invalid')),
      invalidGraph,
    )

    const graphs = await listGraphs(projectPath)

    // Only valid graph is loaded
    expect(graphs.map((graph) => graph.id)).toEqual(['valid'])
    // No writes during list operation
    expect(writeCalls).toEqual([])
  })

  it('saveGraphContent preserves metadata after metadata-only updates', async () => {
    const projectPath = '/project'

    const initialGraph = createGraph('graph-1', {
      enabled: true,
      order: 0,
      nodes: [
        {
          id: 'node-old',
          type: 'trigger',
          definitionId: 'trigger-startup',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'trigger',
            triggerType: 'startup',
          },
        },
      ],
    })

    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath(initialGraph.id)),
      initialGraph,
    )

    await updateGraphMetadata(projectPath, {
      graphId: initialGraph.id,
      enabled: false,
      order: 9,
    })

    const staleEditorGraph: Graph = {
      ...initialGraph,
      enabled: true,
      order: 0,
      nodes: [
        {
          id: 'node-new',
          type: 'trigger',
          definitionId: 'trigger-startup',
          position: { x: 120, y: 120 },
          data: {
            nodeType: 'trigger',
            triggerType: 'startup',
          },
        },
      ],
      updatedAt: 999,
    }

    const saved = await saveGraphContent(projectPath, staleEditorGraph)

    if (saved === null) {
      throw new Error('Expected saved to not be null')
    }
    expect(saved.enabled).toBe(false)
    expect(saved.order).toBe(9)
    expect(saved.nodes.map((node) => node.id)).toEqual(['node-new'])

    const persistedGraph = projectFileStore.get(
      toStorageKey(projectPath, getGraphFilePath(initialGraph.id)),
    ) as Graph

    expect(persistedGraph.enabled).toBe(false)
    expect(persistedGraph.order).toBe(9)
    expect(persistedGraph.nodes.map((node) => node.id)).toEqual(['node-new'])
  })

  it('returns null for getGraph when graph is invalid', async () => {
    const projectPath = '/project'

    const invalidGraph = { id: 'invalid', name: 'Invalid' }
    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('invalid')),
      invalidGraph,
    )

    const { getGraph } = await import('./storage')
    const result = await getGraph(projectPath, 'invalid')

    expect(result).toBeNull()
  })

  it('returns null for saveGraphContent when graph not found', async () => {
    const projectPath = '/project'

    const nonExistentGraph = createGraph('nonexistent')
    const result = await saveGraphContent(projectPath, nonExistentGraph)

    expect(result).toBeNull()
  })

  it('preserves run-function multiselect/object paramDefaults', async () => {
    const projectPath = '/project'
    const graph = createGraph('rf', {
      nodes: [
        {
          id: 'rf-1',
          type: 'run-function',
          definitionId: 'run-function-rf-1',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'run-function',
            displayName: 'Run Function',
            selectedFunctionKey: 'plugin:snacks-nvim:picker_grep',
            functionSource: {
              type: 'plugin',
              pluginId: 'snacks-nvim',
              functionName: 'picker_grep',
            },
            signature: {
              params: [{ name: 'opts', type: 'any', optional: true }],
              returns: 'void',
              luaCall: 'Snacks.picker.grep($params)',
            },
            paramDefaults: {
              tags: { kind: 'multiselect', values: ['a', 'b'] },
              win: {
                kind: 'object',
                entries: {
                  border: { kind: 'scalar', value: 'rounded' },
                },
              },
            },
          },
        },
      ],
    })

    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('rf')),
      graph,
    )
    const loaded = await listGraphs(projectPath)
    const runFnNode = loaded[0]?.nodes[0]
    if (runFnNode?.type !== 'run-function')
      throw new Error('Expected run-function node')
    if (runFnNode.data.nodeType !== 'run-function')
      throw new Error('Expected run-function data')
    expect(runFnNode.data.paramDefaults['tags']).toEqual({
      kind: 'multiselect',
      values: ['a', 'b'],
    })
    expect(runFnNode.data.paramDefaults['win']).toEqual({
      kind: 'object',
      entries: {
        border: { kind: 'scalar', value: 'rounded' },
      },
    })
  })

  describe('strict graph validation', () => {
    it('rejects graph missing enabled field', async () => {
      const projectPath = '/project'
      const graphMissingEnabled = {
        id: 'missing-enabled',
        name: 'Missing Enabled',
        nodes: [],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        order: 0,
        // enabled is missing
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('missing-enabled')),
        graphMissingEnabled,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects graph missing order field', async () => {
      const projectPath = '/project'
      const graphMissingOrder = {
        id: 'missing-order',
        name: 'Missing Order',
        nodes: [],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        // order is missing
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('missing-order')),
        graphMissingOrder,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects graph with invalid node shape (missing data.nodeType)', async () => {
      const projectPath = '/project'
      const graphWithInvalidNode = {
        id: 'invalid-node',
        name: 'Invalid Node',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            definitionId: 'trigger-startup',
            position: { x: 0, y: 0 },
            data: {
              // missing nodeType
              triggerType: 'startup',
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-node')),
        graphWithInvalidNode,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects graph with invalid node position (non-numeric x)', async () => {
      const projectPath = '/project'
      const graphWithInvalidPosition = {
        id: 'invalid-position',
        name: 'Invalid Position',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            definitionId: 'trigger-startup',
            position: { x: 'invalid', y: 0 },
            data: {
              nodeType: 'trigger',
              triggerType: 'startup',
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-position')),
        graphWithInvalidPosition,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects graph with invalid edge shape (missing targetPort)', async () => {
      const projectPath = '/project'
      const graphWithInvalidEdge = {
        id: 'invalid-edge',
        name: 'Invalid Edge',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            definitionId: 'trigger-startup',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'trigger',
              triggerType: 'startup',
            },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            sourcePort: 'out',
            target: 'node-1',
            // missing targetPort
          },
        ],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-edge')),
        graphWithInvalidEdge,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects graph with invalid viewport (zoom as string)', async () => {
      const projectPath = '/project'
      const graphWithInvalidViewport = {
        id: 'invalid-viewport',
        name: 'Invalid Viewport',
        nodes: [],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
        viewport: {
          x: 0,
          y: 0,
          zoom: '1', // should be number
        },
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-viewport')),
        graphWithInvalidViewport,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('accepts graph with valid viewport', async () => {
      const projectPath = '/project'
      const graphWithValidViewport = {
        id: 'valid-viewport',
        name: 'Valid Viewport',
        nodes: [],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
        viewport: {
          x: 100,
          y: 50,
          zoom: 1.5,
        },
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid-viewport')),
        graphWithValidViewport,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(1)
      expect(graphs[0]?.viewport).toEqual({
        x: 100,
        y: 50,
        zoom: 1.5,
      })
    })

    it('skips invalid files without writing migrations', async () => {
      const projectPath = '/project'

      const validGraph = createGraph('valid', { order: 0 })
      const invalidGraphs = [
        { id: 'invalid-1', name: 'Missing enabled/order' },
        { id: 'invalid-2', name: 'Missing fields', enabled: true }, // missing order
        { id: 'invalid-3', name: 'Wrong types', enabled: 'yes', order: '0' },
      ]

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid')),
        validGraph,
      )

      for (const invalid of invalidGraphs) {
        projectFileStore.set(
          toStorageKey(projectPath, getGraphFilePath(invalid.id)),
          invalid,
        )
      }

      const graphs = await listGraphs(projectPath)

      // Only valid graph is loaded
      expect(graphs.map((g) => g.id)).toEqual(['valid'])
      // No writes during list operation (no migrations)
      expect(writeCalls).toEqual([])
    })
  })

  describe('strict node validation', () => {
    it('rejects node when node.type !== data.nodeType', async () => {
      const projectPath = '/project'
      const graphWithMismatchedType = {
        id: 'mismatched-type',
        name: 'Mismatched Type',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger', // This is trigger
            definitionId: 'trigger-startup',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action', // But data says action - mismatch!
              actionType: 'set-option',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-option',
                optionName: 'test',
                scope: 'global',
                valueConfig: {
                  valueMode: 'suggested',
                  suggestedValue: '',
                },
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('mismatched-type')),
        graphWithMismatchedType,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects trigger node missing triggerType', async () => {
      const projectPath = '/project'
      const graphWithInvalidTrigger = {
        id: 'invalid-trigger',
        name: 'Invalid Trigger',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            definitionId: 'trigger-startup',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'trigger',
              // triggerType is missing
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-trigger')),
        graphWithInvalidTrigger,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects trigger node with non-startup triggerType', async () => {
      const projectPath = '/project'
      const graphWithInvalidTrigger = {
        id: 'invalid-trigger-type',
        name: 'Invalid Trigger Type',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            definitionId: 'trigger-startup',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'trigger',
              triggerType: 'on-save', // Not 'startup'
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-trigger-type')),
        graphWithInvalidTrigger,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects action node missing actionType', async () => {
      const projectPath = '/project'
      const graphWithInvalidAction = {
        id: 'invalid-action',
        name: 'Invalid Action',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-option',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              // actionType is missing
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-option',
                optionName: 'test',
                scope: 'global',
                valueConfig: {
                  valueMode: 'suggested',
                  suggestedValue: '',
                },
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-action')),
        graphWithInvalidAction,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects action node with mismatched actionConfigType', async () => {
      const projectPath = '/project'
      const graphWithMismatchedConfig = {
        id: 'mismatched-config',
        name: 'Mismatched Config',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-option',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-option',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'run-action', // Mismatched - should be 'set-option'
                action: 'test',
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('mismatched-config')),
        graphWithMismatchedConfig,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects condition node missing operator', async () => {
      const projectPath = '/project'
      const graphWithInvalidCondition = {
        id: 'invalid-condition',
        name: 'Invalid Condition',
        nodes: [
          {
            id: 'node-1',
            type: 'condition',
            definitionId: 'condition-eq',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'condition',
              // operator is missing
              hardcodedA: 'a',
              hardcodedB: 'b',
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-condition')),
        graphWithInvalidCondition,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects loop node with invalid loopType', async () => {
      const projectPath = '/project'
      const graphWithInvalidLoop = {
        id: 'invalid-loop',
        name: 'Invalid Loop',
        nodes: [
          {
            id: 'node-1',
            type: 'loop',
            definitionId: 'loop-for',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'loop',
              loopType: 'invalid-loop-type', // Not in ['for', 'while', 'each']
              iteratorVariable: 'i',
              iterableExpression: 'items',
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-loop')),
        graphWithInvalidLoop,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects code-block node missing code', async () => {
      const projectPath = '/project'
      const graphWithInvalidCodeBlock = {
        id: 'invalid-code-block',
        name: 'Invalid Code Block',
        nodes: [
          {
            id: 'node-1',
            type: 'code-block',
            definitionId: 'code-block-exec',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'code-block',
              // code is missing
              inputs: [],
              outputs: [],
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-code-block')),
        graphWithInvalidCodeBlock,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects graph-ref node missing referencedGraphId', async () => {
      const projectPath = '/project'
      const graphWithInvalidGraphRef = {
        id: 'invalid-graph-ref',
        name: 'Invalid Graph Ref',
        nodes: [
          {
            id: 'node-1',
            type: 'graph-ref',
            definitionId: 'graph-ref-callable',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'graph-ref',
              // referencedGraphId is missing
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-graph-ref')),
        graphWithInvalidGraphRef,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('accepts valid action node with matching actionConfigType', async () => {
      const projectPath = '/project'
      const graphWithValidAction = {
        id: 'valid-action',
        name: 'Valid Action',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-option',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-option',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-option',
                optionName: 'number',
                scope: 'global',
                valueConfig: {
                  valueMode: 'suggested',
                  suggestedValue: true,
                },
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid-action')),
        graphWithValidAction,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(1)
      expect(graphs[0]?.id).toBe('valid-action')
    })

    it('accepts valid trigger node with startup type', async () => {
      const projectPath = '/project'
      const graphWithValidTrigger = {
        id: 'valid-trigger',
        name: 'Valid Trigger',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            definitionId: 'trigger-startup',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'trigger',
              triggerType: 'startup',
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid-trigger')),
        graphWithValidTrigger,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(1)
      expect(graphs[0]?.id).toBe('valid-trigger')
    })
  })

  describe('strict action config validation', () => {
    it('rejects set-keymap with unknown mode', async () => {
      const projectPath = '/project'
      const graphWithUnknownMode = {
        id: 'unknown-mode',
        name: 'Unknown Mode',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-keymap',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-keymap',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-keymap',
                modes: ['normal'], // Invalid - should be 'n'
                keySequence: '<leader>x',
                command: ':echo test<CR>',
                description: '',
                silent: true,
                noremap: true,
                expr: false,
                showInKeymaps: true,
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('unknown-mode')),
        graphWithUnknownMode,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects set-keymap with empty modes array', async () => {
      const projectPath = '/project'
      const graphWithEmptyModes = {
        id: 'empty-modes',
        name: 'Empty Modes',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-keymap',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-keymap',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-keymap',
                modes: [], // Empty - invalid
                keySequence: '<leader>x',
                command: ':echo test<CR>',
                description: '',
                silent: true,
                noremap: true,
                expr: false,
                showInKeymaps: true,
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('empty-modes')),
        graphWithEmptyModes,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects set-variable with valueType raw and non-string value', async () => {
      const projectPath = '/project'
      const graphWithInvalidRaw = {
        id: 'invalid-raw',
        name: 'Invalid Raw',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-variable',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-variable',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-variable',
                scope: 'g',
                variableName: 'test_var',
                valueType: 'raw',
                value: 123, // Invalid - should be string for 'raw' type
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-raw')),
        graphWithInvalidRaw,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects set-variable with valueType number and string value', async () => {
      const projectPath = '/project'
      const graphWithInvalidNumber = {
        id: 'invalid-number',
        name: 'Invalid Number',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-variable',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-variable',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-variable',
                scope: 'g',
                variableName: 'test_var',
                valueType: 'number',
                value: 'not a number', // Invalid - should be number
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-number')),
        graphWithInvalidNumber,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('accepts valid canonical set-keymap config', async () => {
      const projectPath = '/project'
      const graphWithValidKeymap = {
        id: 'valid-keymap',
        name: 'Valid Keymap',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-keymap',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-keymap',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-keymap',
                modes: ['n', 'i'], // Valid canonical modes
                keySequence: '<leader>x',
                command: ':echo test<CR>',
                description: 'Test keymap',
                silent: true,
                noremap: true,
                expr: false,
                showInKeymaps: true,
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid-keymap')),
        graphWithValidKeymap,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(1)
      expect(graphs[0]?.id).toBe('valid-keymap')
    })

    it('accepts valid set-variable configs for allowed value types', async () => {
      const projectPath = '/project'
      const graphWithValidVariables = {
        id: 'valid-variables',
        name: 'Valid Variables',
        nodes: [
          {
            id: 'node-string',
            type: 'action',
            definitionId: 'action-set-variable',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-variable',
              label: 'String Var',
              actionConfig: {
                actionConfigType: 'set-variable',
                scope: 'g',
                variableName: 'str_var',
                valueType: 'string',
                value: 'hello',
              },
            },
          },
          {
            id: 'node-number',
            type: 'action',
            definitionId: 'action-set-variable',
            position: { x: 100, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-variable',
              label: 'Number Var',
              actionConfig: {
                actionConfigType: 'set-variable',
                scope: 'b',
                variableName: 'num_var',
                valueType: 'number',
                value: 42,
              },
            },
          },
          {
            id: 'node-boolean',
            type: 'action',
            definitionId: 'action-set-variable',
            position: { x: 200, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-variable',
              label: 'Boolean Var',
              actionConfig: {
                actionConfigType: 'set-variable',
                scope: 'w',
                variableName: 'bool_var',
                valueType: 'boolean',
                value: true,
              },
            },
          },
          {
            id: 'node-raw',
            type: 'action',
            definitionId: 'action-set-variable',
            position: { x: 300, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-variable',
              label: 'Raw Var',
              actionConfig: {
                actionConfigType: 'set-variable',
                scope: 't',
                variableName: 'raw_var',
                valueType: 'raw',
                value: 'vim.fn.expand("%:p")',
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid-variables')),
        graphWithValidVariables,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(1)
      expect(graphs[0]?.id).toBe('valid-variables')
      expect(graphs[0]?.nodes).toHaveLength(4)
    })

    it('rejects non-string run-action paramValues', async () => {
      const projectPath = '/project'
      const graphWithNonStringParam = {
        id: 'non-string-param',
        name: 'Non String Param',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-run-action',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'run-action',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'run-action',
                mode: 'catalog',
                actionType: 'command',
                action: 'test',
                selectedActionKey: 'write',
                paramValues: { count: 5 }, // Invalid - should be string
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('non-string-param')),
        graphWithNonStringParam,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('accepts valid run-action paramValues', async () => {
      const projectPath = '/project'
      const graphWithValidParams = {
        id: 'valid-params',
        name: 'Valid Params',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-run-action',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'run-action',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'run-action',
                mode: 'catalog',
                actionType: 'command',
                action: 'test',
                selectedActionKey: 'write',
                paramValues: { count: '5', file: 'init.lua' }, // Valid strings
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('valid-params')),
        graphWithValidParams,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(1)
      expect(graphs[0]?.id).toBe('valid-params')
    })

    it('rejects code-block port invalid dataType', async () => {
      const projectPath = '/project'
      const graphWithInvalidPortType = {
        id: 'invalid-port-type',
        name: 'Invalid Port Type',
        nodes: [
          {
            id: 'node-1',
            type: 'code-block',
            definitionId: 'code-block-exec',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'code-block',
              code: 'return x',
              inputs: [
                { id: 'in-1', name: 'x', dataType: 'invalid-type' }, // Invalid dataType
              ],
              outputs: [],
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-port-type')),
        graphWithInvalidPortType,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects callable-entry port invalid dataType', async () => {
      const projectPath = '/project'
      const graphWithInvalidCallablePort = {
        id: 'invalid-callable-port',
        name: 'Invalid Callable Port',
        nodes: [
          {
            id: 'node-1',
            type: 'callable-entry',
            definitionId: 'callable-entry-main',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'callable-entry',
              parameters: [
                { id: 'p1', name: 'arg', dataType: 'not-a-port-type' }, // Invalid dataType
              ],
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('invalid-callable-port')),
        graphWithInvalidCallablePort,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })

    it('rejects set-keymap duplicate modes', async () => {
      const projectPath = '/project'
      const graphWithDuplicateModes = {
        id: 'duplicate-modes',
        name: 'Duplicate Modes',
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            definitionId: 'action-set-keymap',
            position: { x: 0, y: 0 },
            data: {
              nodeType: 'action',
              actionType: 'set-keymap',
              label: 'Test',
              actionConfig: {
                actionConfigType: 'set-keymap',
                modes: ['n', 'n'], // Duplicate modes - invalid
                keySequence: '<leader>x',
                command: ':echo test<CR>',
                description: '',
                silent: true,
                noremap: true,
                expr: false,
                showInKeymaps: true,
              },
            },
          },
        ],
        edges: [],
        createdAt: 1,
        updatedAt: 10,
        enabled: true,
        order: 0,
      }

      projectFileStore.set(
        toStorageKey(projectPath, getGraphFilePath('duplicate-modes')),
        graphWithDuplicateModes,
      )

      const graphs = await listGraphs(projectPath)
      expect(graphs).toHaveLength(0)
    })
  })
})

describe('updateGraphOrderBatch', () => {
  beforeEach(() => {
    projectFileStore.clear()
    writeCalls.length = 0
  })

  it('returns success with updated IDs when all updates succeed', async () => {
    const projectPath = '/project'
    const graphA = createGraph('a', { order: 0 })
    const graphB = createGraph('b', { order: 1 })

    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('a')),
      graphA,
    )
    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('b')),
      graphB,
    )

    const result = await updateGraphOrderBatch(projectPath, [
      { graphId: 'a', order: 1 },
      { graphId: 'b', order: 0 },
    ])

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedGraphIds).toEqual(['a', 'b'])
    }
  })

  it('returns failure on first null and stops processing', async () => {
    const projectPath = '/project'
    const graphA = createGraph('a', { order: 0 })

    // Only graph A exists - graph B is missing
    projectFileStore.set(
      toStorageKey(projectPath, getGraphFilePath('a')),
      graphA,
    )

    const result = await updateGraphOrderBatch(projectPath, [
      { graphId: 'a', order: 1 },
      { graphId: 'b', order: 0 }, // This will fail
    ])

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.failedGraphId).toBe('b')
      expect(result.failedOrder).toBe(0)
      expect(result.appliedGraphIds).toEqual(['a'])
      expect(result.error).toContain('Failed to update order')
    }

    // Graph A should have been updated before the failure
    const updatedA = projectFileStore.get(
      toStorageKey(projectPath, getGraphFilePath('a')),
    ) as Graph
    expect(updatedA?.order).toBe(1)
  })

  it('returns success for empty updates array', async () => {
    const projectPath = '/project'

    const result = await updateGraphOrderBatch(projectPath, [])

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedGraphIds).toEqual([])
    }
  })
})
