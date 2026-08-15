import { beforeEach, describe, expect, it } from 'vitest'
import type {
  ActionNodeData,
  BuiltinNodeData,
  CreateAutocmdActionConfig,
  Graph,
  GraphNode,
  RunFunctionNodeData,
} from '@/shared/types'
import { createActionNodeData } from '@/shared/types'
import { collectNodePortSets, useGraphEditorStore } from './store'

function createSourceNode(): GraphNode {
  return {
    id: 'source-node',
    type: 'trigger',
    definitionId: 'trigger-startup',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'trigger',
      triggerType: 'startup',
    },
  }
}

function createCreateAutocmdNode(
  id: string = 'autocmd-node',
  overrides?: Partial<CreateAutocmdActionConfig>,
): GraphNode<ActionNodeData> {
  const config: CreateAutocmdActionConfig = {
    actionConfigType: 'create-autocmd',
    events: ['BufEnter'],
    patterns: ['*'],
    callbackLua: '',
    groupName: '',
    once: false,
    nested: false,
    ...overrides,
  }

  return {
    id,
    type: 'action',
    definitionId: 'create-autocmd',
    position: { x: 120, y: 120 },
    data: {
      nodeType: 'action',
      actionType: 'create-autocmd',
      label: 'Create Autocmd',
      actionConfig: config,
    },
  }
}

function createTargetNode(id: string = 'target-node'): GraphNode {
  return {
    id,
    type: 'action',
    definitionId: 'run-action',
    position: { x: 240, y: 120 },
    data: {
      nodeType: 'action',
      actionType: 'run-action',
      label: 'Run Action',
      actionConfig: {
        actionConfigType: 'run-action',
        mode: 'catalog',
        actionType: 'command',
        action: ':echo "test"',
        selectedActionKey: '',
        paramValues: {},
      },
    },
  }
}

function createActionNode(
  id: string,
  data: ActionNodeData,
): GraphNode<ActionNodeData> {
  return {
    id,
    type: 'action',
    definitionId: `action.${data.actionType}`,
    position: { x: 120, y: 120 },
    data,
  }
}

function createBuiltinNode(
  id: string,
  builtinId: string,
): GraphNode<BuiltinNodeData> {
  return {
    id,
    type: 'builtin',
    definitionId: `builtin.${builtinId}`,
    position: { x: 120, y: 120 },
    data: {
      nodeType: 'builtin',
      builtinId,
      config: {},
    },
  }
}

function createRunFunctionNode(
  id: string,
  data: Partial<Omit<RunFunctionNodeData, 'nodeType'>>,
): GraphNode<RunFunctionNodeData> {
  return {
    id,
    type: 'run-function',
    definitionId: 'run-function',
    position: { x: 120, y: 120 },
    data: {
      nodeType: 'run-function',
      selectedFunctionKey: data.selectedFunctionKey ?? '',
      functionSource: data.functionSource ?? {
        type: 'core',
        functionName: 'expand',
      },
      signature: data.signature ?? null,
      paramDefaults: data.paramDefaults ?? {},
    },
  }
}

function createGraph(nodes: GraphNode[], edges: Graph['edges']): Graph {
  return {
    id: 'graph-1',
    name: 'Test Graph',
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: 1,
    updatedAt: 1,
    enabled: true,
    order: 0,
  }
}

function resetStore(): void {
  useGraphEditorStore.setState((state) => ({
    ...state,
    graph: null,
    selectedNodeIds: [],
    projectPath: null,
  }))
}

function expectNodePorts(
  node: GraphNode,
  expectedInputPorts: readonly string[],
  expectedOutputPorts: readonly string[],
): void {
  const ports = collectNodePortSets(node)
  expect(ports).not.toBeNull()
  if (!ports) {
    return
  }

  expect([...ports.inputs].sort()).toEqual([...expectedInputPorts].sort())
  expect([...ports.outputs].sort()).toEqual([...expectedOutputPorts].sort())
}

describe('collectNodePortSets', () => {
  it('collects set-keymap ports including on-press and key-sequence inputs', () => {
    const node = createActionNode(
      'set-keymap-node',
      createActionNodeData('set-keymap'),
    )
    expectNodePorts(node, ['exec', 'on-press', 'key-sequence'], ['done'])
  })

  it('collects set-variable ports including value input', () => {
    const node = createActionNode(
      'set-variable-node',
      createActionNodeData('set-variable'),
    )
    expectNodePorts(node, ['exec', 'value'], ['done'])
  })

  it('collects set-highlight ports including foreground/background/group-name inputs', () => {
    const node = createActionNode(
      'set-highlight-node',
      createActionNodeData('set-highlight'),
    )
    expectNodePorts(
      node,
      ['exec', 'foreground', 'background', 'group-name'],
      ['done'],
    )
  })

  it('collects get-variable ports including value output', () => {
    const node = createActionNode(
      'get-variable-node',
      createActionNodeData('get-variable'),
    )
    expectNodePorts(node, ['exec'], ['done', 'value'])
  })

  it('collects builtin ports for ui.notify', () => {
    const node = createBuiltinNode('notify-node', 'ui.notify')
    expectNodePorts(node, ['exec', 'message', 'title'], ['done'])
  })

  it('collects builtin ports for buffers.open-file', () => {
    const node = createBuiltinNode('open-file-node', 'buffers.open-file')
    expectNodePorts(node, ['exec', 'path'], ['done'])
  })

  it('collects run-function ports with no signature (exec+done only)', () => {
    const node = createRunFunctionNode('rf-node', { signature: null })
    expectNodePorts(node, ['exec'], ['done'])
  })

  it('collects run-function ports from signature params', () => {
    const node = createRunFunctionNode('rf-node', {
      signature: {
        params: [
          { name: 'bufnr', type: 'buffer' },
          { name: 'opts', type: 'table', optional: true },
        ],
        returns: 'void',
        luaCall: 'vim.lsp.buf.format($params.bufnr, $params.opts)',
      },
    })
    expectNodePorts(node, ['exec', 'param:bufnr', 'param:opts'], ['done'])
  })

  it('adds result output port when signature returns non-void', () => {
    const node = createRunFunctionNode('rf-node', {
      signature: {
        params: [{ name: 'expr', type: 'string' }],
        returns: 'string',
        luaCall: 'vim.fn.expand($params.expr)',
      },
    })
    expectNodePorts(node, ['exec', 'param:expr'], ['done', 'result'])
  })

  it('run-function with void return has no result port', () => {
    const node = createRunFunctionNode('rf-node', {
      signature: {
        params: [],
        returns: 'void',
        luaCall: 'vim.cmd("write")',
      },
    })
    expectNodePorts(node, ['exec'], ['done'])
  })
})

describe('edge reconciliation when ports change', () => {
  beforeEach(() => {
    resetStore()
  })

  it('removes invalid set-keymap input edges after switching to run-action', () => {
    const keymapNode = createActionNode(
      'keymap-node',
      createActionNodeData('set-keymap'),
    )
    const graph = createGraph(
      [createSourceNode(), keymapNode],
      [
        {
          id: 'edge-exec',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'keymap-node',
          targetPort: 'exec',
        },
        {
          id: 'edge-on-press',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'keymap-node',
          targetPort: 'on-press',
        },
        {
          id: 'edge-key-sequence',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'keymap-node',
          targetPort: 'key-sequence',
        },
      ],
    )

    useGraphEditorStore.getState().loadGraph(graph)
    useGraphEditorStore
      .getState()
      .updateNodeData<ActionNodeData>('keymap-node', {
        actionType: 'run-action',
        actionConfig: createActionNodeData('run-action').actionConfig,
      })

    const updatedGraph = useGraphEditorStore.getState().graph
    if (!updatedGraph) {
      throw new Error('Expected graph to be loaded')
    }

    const targetPorts = updatedGraph.edges
      .filter((edge) => edge.target === 'keymap-node')
      .map((edge) => edge.targetPort)
      .sort()

    expect(targetPorts).toEqual(['exec'])
  })

  it('removes invalid get-variable output edges after switching to run-action', () => {
    const getVariableNode = createActionNode(
      'get-variable-node',
      createActionNodeData('get-variable'),
    )
    const graph = createGraph(
      [createSourceNode(), getVariableNode, createTargetNode()],
      [
        {
          id: 'edge-done',
          source: 'get-variable-node',
          sourcePort: 'done',
          target: 'target-node',
          targetPort: 'exec',
        },
        {
          id: 'edge-value',
          source: 'get-variable-node',
          sourcePort: 'value',
          target: 'target-node',
          targetPort: 'exec',
        },
      ],
    )

    useGraphEditorStore.getState().loadGraph(graph)
    useGraphEditorStore
      .getState()
      .updateNodeData<ActionNodeData>('get-variable-node', {
        actionType: 'run-action',
        actionConfig: createActionNodeData('run-action').actionConfig,
      })

    const updatedGraph = useGraphEditorStore.getState().graph
    if (!updatedGraph) {
      throw new Error('Expected graph to be loaded')
    }

    const sourcePorts = updatedGraph.edges
      .filter((edge) => edge.source === 'get-variable-node')
      .map((edge) => edge.sourcePort)
      .sort()

    expect(sourcePorts).toEqual(['done'])
  })

  it('reconciles builtin node edges when builtinId changes', () => {
    const builtinNode = createBuiltinNode('builtin-node', 'ui.notify')
    const graph = createGraph(
      [createSourceNode(), builtinNode],
      [
        {
          id: 'edge-exec',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'builtin-node',
          targetPort: 'exec',
        },
        {
          id: 'edge-message',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'builtin-node',
          targetPort: 'message',
        },
      ],
    )

    useGraphEditorStore.getState().loadGraph(graph)
    useGraphEditorStore
      .getState()
      .updateNodeData<BuiltinNodeData>('builtin-node', {
        builtinId: 'buffers.open-file',
      })

    const updatedGraph = useGraphEditorStore.getState().graph
    if (!updatedGraph) {
      throw new Error('Expected graph to be loaded')
    }

    const targetPorts = updatedGraph.edges
      .filter((edge) => edge.target === 'builtin-node')
      .map((edge) => edge.targetPort)
      .sort()

    expect(targetPorts).toEqual(['exec'])
  })

  it('removes stale param ports when run-function signature changes', () => {
    const rfNode = createRunFunctionNode('rf-node', {
      signature: {
        params: [
          { name: 'bufnr', type: 'buffer' },
          { name: 'opts', type: 'table', optional: true },
        ],
        returns: 'void',
        luaCall: 'vim.lsp.buf.format($params.bufnr, $params.opts)',
      },
    })
    const graph = createGraph(
      [createSourceNode(), rfNode],
      [
        {
          id: 'edge-exec',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'rf-node',
          targetPort: 'exec',
        },
        {
          id: 'edge-bufnr',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'rf-node',
          targetPort: 'param:bufnr',
        },
        {
          id: 'edge-opts',
          source: 'source-node',
          sourcePort: 'exec',
          target: 'rf-node',
          targetPort: 'param:opts',
        },
      ],
    )

    useGraphEditorStore.getState().loadGraph(graph)
    // Update to a signature with only one param
    useGraphEditorStore
      .getState()
      .updateNodeData<RunFunctionNodeData>('rf-node', {
        signature: {
          params: [{ name: 'bufnr', type: 'buffer' }],
          returns: 'void',
          luaCall: 'vim.lsp.buf.format($params.bufnr)',
        },
      })

    const updatedGraph = useGraphEditorStore.getState().graph
    if (!updatedGraph) {
      throw new Error('Expected graph to be loaded')
    }

    const targetPorts = updatedGraph.edges
      .filter((edge) => edge.target === 'rf-node')
      .map((edge) => edge.targetPort)
      .sort()

    expect(targetPorts).toEqual(['exec', 'param:bufnr'])
  })
})

describe('create-autocmd on-event port', () => {
  beforeEach(() => {
    useGraphEditorStore.setState((state) => ({
      ...state,
      graph: null,
      selectedNodeIds: [],
      projectPath: null,
    }))
  })

  function createGraphWithOnEventEdge(): Graph {
    return {
      id: 'graph-1',
      name: 'Test Graph',
      nodes: [
        createSourceNode(),
        createCreateAutocmdNode('autocmd-node'),
        createTargetNode('target-node'),
      ],
      edges: [
        {
          id: 'edge-done',
          source: 'autocmd-node',
          sourcePort: 'done',
          target: 'target-node',
          targetPort: 'exec',
        },
        {
          id: 'edge-on-event',
          source: 'autocmd-node',
          sourcePort: 'on-event',
          target: 'target-node',
          targetPort: 'exec',
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: 1,
      updatedAt: 1,
      enabled: true,
      order: 0,
    }
  }

  function getAutocmdNodeEdges(): { sourcePorts: string[]; edgeCount: number } {
    const graph = useGraphEditorStore.getState().graph
    if (!graph) {
      return { sourcePorts: [], edgeCount: 0 }
    }

    const edges = graph.edges.filter((edge) => edge.source === 'autocmd-node')
    return {
      sourcePorts: edges.map((edge) => edge.sourcePort).sort(),
      edgeCount: edges.length,
    }
  }

  it('accepts on-event as a valid sourcePort for create-autocmd node', () => {
    const graph = createGraphWithOnEventEdge()
    useGraphEditorStore.getState().loadGraph(graph)

    const { sourcePorts, edgeCount } = getAutocmdNodeEdges()
    expect(edgeCount).toBe(2)
    expect(sourcePorts).toContain('done')
    expect(sourcePorts).toContain('on-event')
  })

  it('keeps on-event edges during loadGraph reconciliation', () => {
    const graph = createGraphWithOnEventEdge()
    useGraphEditorStore.getState().loadGraph(graph)

    const { sourcePorts, edgeCount } = getAutocmdNodeEdges()
    expect(edgeCount).toBe(2)
    expect(sourcePorts).toEqual(['done', 'on-event'])
  })

  it('preserves on-event edges when updating unrelated node data', () => {
    const graph = createGraphWithOnEventEdge()
    useGraphEditorStore.getState().loadGraph(graph)

    // Update unrelated config (events) - should not affect edges
    useGraphEditorStore
      .getState()
      .updateNodeData<ActionNodeData>('autocmd-node', {
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: ['BufReadPost'],
          patterns: ['*.lua'],
          callbackLua: '',
          groupName: 'MyGroup',
          once: true,
          nested: false,
        },
      })

    const { sourcePorts, edgeCount } = getAutocmdNodeEdges()
    expect(edgeCount).toBe(2)
    expect(sourcePorts).toContain('done')
    expect(sourcePorts).toContain('on-event')
  })

  it('preserves explicit empty create-autocmd events on update', () => {
    const graph = createGraphWithOnEventEdge()
    useGraphEditorStore.getState().loadGraph(graph)

    useGraphEditorStore
      .getState()
      .updateNodeData<ActionNodeData>('autocmd-node', {
        actionConfig: {
          actionConfigType: 'create-autocmd',
          events: [],
          patterns: ['*.lua'],
          callbackLua: '',
          groupName: '',
          once: false,
          nested: false,
        },
      })

    const updatedGraph = useGraphEditorStore.getState().graph
    if (!updatedGraph) {
      throw new Error('Expected graph to be loaded')
    }

    const autocmdNode = updatedGraph.nodes.find(
      (node) => node.id === 'autocmd-node',
    )
    if (!autocmdNode || autocmdNode.data.nodeType !== 'action') {
      throw new Error('Expected create-autocmd action node to exist')
    }
    if (autocmdNode.data.actionType !== 'create-autocmd') {
      throw new Error('Expected create-autocmd action type')
    }

    expect(autocmdNode.data.actionConfig.events).toEqual([])
  })

  it('removes on-event edges when updating to a different action type', () => {
    const graph = createGraphWithOnEventEdge()
    useGraphEditorStore.getState().loadGraph(graph)

    // Switching to run-action (which only has 'done' output)
    useGraphEditorStore
      .getState()
      .updateNodeData<ActionNodeData>('autocmd-node', {
        actionType: 'run-action',
        actionConfig: {
          actionConfigType: 'run-action',
          mode: 'custom-command',
          actionType: 'command',
          action: ':echo "switched"',
          selectedActionKey: '',
          paramValues: {},
        },
      })

    const { sourcePorts, edgeCount } = getAutocmdNodeEdges()
    // on-event edge should be removed since run-action doesn't have that port
    expect(edgeCount).toBe(1)
    expect(sourcePorts).toEqual(['done'])
  })
})
