import { describe, expect, it } from 'vitest'
import { normalizeAutocmdEventNames } from '@/shared/data/neovim/events'
import type {
  ConditionNodeData,
  Graph,
  GraphNode,
  TriggerNodeData,
} from '@/shared/types'
import {
  buildConditionExpression,
  createActionNodeData,
  normalizeActionNodeData,
  normalizeCreateAutocmdEvents,
  normalizeGraphForEditor,
  normalizePatternEntries,
} from '@/shared/types'
import type { CreateAutocmdActionConfig } from '@/shared/types/graph'

function buildGraphWithTriggerData(triggerData: unknown): Graph {
  return {
    id: 'graph-1',
    name: 'Test Graph',
    nodes: [
      {
        id: 'node-trigger-1',
        type: 'trigger',
        definitionId: 'trigger.on-startup',
        position: { x: 0, y: 0 },
        data: triggerData as TriggerNodeData,
      },
    ],
    edges: [],
    createdAt: 1,
    updatedAt: 1,
    enabled: true,
    order: 0,
  }
}

function buildGraphWithActionNode(
  actionData: CreateAutocmdActionConfig | unknown,
): Graph {
  return {
    id: 'graph-1',
    name: 'Test Graph',
    nodes: [
      {
        id: 'node-action-1',
        type: 'action',
        definitionId: 'action.create-autocmd',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'action',
          actionType: 'create-autocmd',
          label: 'Create Autocmd',
          actionConfig: actionData as CreateAutocmdActionConfig,
        },
      },
    ],
    edges: [],
    createdAt: 1,
    updatedAt: 1,
    enabled: true,
    order: 0,
  }
}

function getNormalizedTriggerNode(graph: Graph): GraphNode<TriggerNodeData> {
  const normalizedGraph = normalizeGraphForEditor(graph)
  const node = normalizedGraph.nodes[0]

  if (!node || node.data.nodeType !== 'trigger') {
    throw new Error('Expected first node to be a trigger node')
  }

  return node as GraphNode<TriggerNodeData>
}

function getNormalizedActionConfig(graph: Graph): CreateAutocmdActionConfig {
  const normalizedGraph = normalizeGraphForEditor(graph)
  const node = normalizedGraph.nodes[0]

  if (!node || node.data.nodeType !== 'action') {
    throw new Error('Expected first node to be an action node')
  }

  const actionNode = node as GraphNode<{
    nodeType: 'action'
    actionType: 'create-autocmd'
    label: string
    actionConfig: CreateAutocmdActionConfig
  }>

  return actionNode.data.actionConfig
}

describe('normalizeGraphForEditor trigger normalization', () => {
  it('normalizes valid startup trigger', () => {
    const node = getNormalizedTriggerNode(
      buildGraphWithTriggerData({
        nodeType: 'trigger',
        triggerType: 'startup',
      }),
    )

    expect(node.data.triggerType).toBe('startup')
  })

  it('preserves displayName during normalization', () => {
    const node = getNormalizedTriggerNode(
      buildGraphWithTriggerData({
        nodeType: 'trigger',
        triggerType: 'startup',
        displayName: 'My Custom Trigger',
      }),
    )

    expect(node.data.triggerType).toBe('startup')
    expect(node.data.displayName).toBe('My Custom Trigger')
  })

  it('returns default trigger for invalid data', () => {
    const node = getNormalizedTriggerNode(
      buildGraphWithTriggerData({
        nodeType: 'trigger',
        triggerType: 'invalid-type',
      }),
    )

    expect(node.data.triggerType).toBe('startup')
  })

  it('returns default trigger for missing data', () => {
    // Test with undefined/missing node data rather than null
    const graph = buildGraphWithTriggerData({ nodeType: 'trigger' })
    const normalizedGraph = normalizeGraphForEditor(graph)
    const node = normalizedGraph.nodes[0]

    expect(node).toBeDefined()
    expect(node?.data.nodeType).toBe('trigger')
    expect((node?.data as TriggerNodeData).triggerType).toBe('startup')
  })
})

describe('action config normalization', () => {
  it('normalizes get-variable node data with fallback config defaults', () => {
    const normalized = normalizeActionNodeData({
      nodeType: 'action',
      actionType: 'get-variable',
      label: 'Get Variable',
      actionConfig: {
        actionConfigType: 'get-variable',
        scope: 'invalid-scope',
        variableName: 42,
      },
    })

    expect(normalized.actionType).toBe('get-variable')
    expect(normalized.actionConfig.actionConfigType).toBe('get-variable')
    if (normalized.actionConfig.actionConfigType !== 'get-variable') {
      throw new Error('Expected get-variable action config')
    }

    expect(normalized.actionConfig.scope).toBe('g')
    expect(normalized.actionConfig.variableName).toBe('example_variable')
  })

  it('normalizes set-variable raw configs through normalizeActionConfig', () => {
    const normalized = normalizeActionNodeData({
      nodeType: 'action',
      actionType: 'set-variable',
      label: 'Set Variable',
      actionConfig: {
        actionConfigType: 'set-variable',
        scope: 'g',
        variableName: 'raw_expr',
        valueType: 'raw',
        value: 'vim.fn.expand("%:p")',
      },
    })

    expect(normalized.actionType).toBe('set-variable')
    expect(normalized.actionConfig.actionConfigType).toBe('set-variable')
    if (normalized.actionConfig.actionConfigType !== 'set-variable') {
      throw new Error('Expected set-variable action config')
    }

    expect(normalized.actionConfig.valueType).toBe('raw')
    expect(normalized.actionConfig.value).toBe('vim.fn.expand("%:p")')

    const createdNodeData = createActionNodeData('set-variable', {
      actionConfig: normalized.actionConfig,
    })
    expect(createdNodeData.actionConfig.valueType).toBe('raw')
  })

  it('returns default valueConfig for invalid legacy format', () => {
    // Legacy format with valueType/value fields should return default
    const normalized = normalizeActionNodeData({
      nodeType: 'action',
      actionType: 'set-option',
      label: 'Set Option',
      actionConfig: {
        actionConfigType: 'set-option',
        optionName: 'number',
        scope: 'global',
        // Legacy fields - should be ignored, return default
        valueType: 'boolean',
        value: true,
      },
    })

    expect(normalized.actionType).toBe('set-option')
    if (normalized.actionConfig.actionConfigType !== 'set-option') {
      throw new Error('Expected set-option action config')
    }
    expect(normalized.actionConfig.valueConfig).toEqual({
      valueMode: 'suggested',
      suggestedValue: true,
    })
  })
})

describe('normalizePatternEntries', () => {
  it('trims, dedupes, and falls back to wildcard', () => {
    expect(normalizePatternEntries([' *.lua ', '', '*.lua', '   '])).toEqual([
      '*.lua',
    ])
    expect(normalizePatternEntries(['', '   '])).toEqual(['*'])
  })

  it('preserves brace patterns like *.{ts,tsx} as single entries', () => {
    expect(normalizePatternEntries(['*.{ts,tsx}'])).toEqual(['*.{ts,tsx}'])
    expect(normalizePatternEntries(['*.{ts,tsx}', '*.lua'])).toEqual([
      '*.{ts,tsx}',
      '*.lua',
    ])
  })
})

describe('create-autocmd pattern normalization', () => {
  it('uses patterns array when provided', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: ['BufWritePre'],
        patterns: ['*.lua', '*.md'],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.patterns).toEqual(['*.lua', '*.md'])
  })

  it('does NOT migrate legacy single pattern string (canonical only)', () => {
    // Legacy format with single pattern string - should use default
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: ['BufWritePre'],
        pattern: '*.lua', // legacy single string - ignored
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    // Should use default patterns instead of migrating legacy field
    expect(config.patterns).toEqual(['*'])
  })

  it('trims and dedupes patterns', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: ['BufWritePre'],
        patterns: ['  *.lua  ', '*.lua', '*.md'],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.patterns).toEqual(['*.lua', '*.md'])
  })

  it('falls back to wildcard when patterns normalize to empty', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: ['BufWritePre'],
        patterns: ['   ', ''],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.patterns).toEqual(['*'])
  })

  it('defaults to wildcard when no pattern fields provided', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: ['BufWritePre'],
        // No patterns field
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.patterns).toEqual(['*'])
  })
})

describe('normalizeCreateAutocmdEvents', () => {
  it('delegates to shared autocmd event normalization helper', () => {
    const input = ['bufenter', 'BUFENTER', 'DirChanged', 'UserMyEvent', 'Nope']
    expect(normalizeCreateAutocmdEvents(input)).toEqual(
      normalizeAutocmdEventNames(input),
    )
  })

  it('trims whitespace from event names', () => {
    expect(
      normalizeCreateAutocmdEvents(['  BufEnter  ', '  BufLeave  ']),
    ).toEqual(['BufEnter', 'BufLeave'])
  })

  it('case-canonicalizes known event names', () => {
    expect(
      normalizeCreateAutocmdEvents(['bufenter', 'BUFENTER', 'BufEnter']),
    ).toEqual(['BufEnter'])
    expect(normalizeCreateAutocmdEvents(['bufreadpre', 'BufReadPre'])).toEqual([
      'BufReadPre',
    ])
    expect(normalizeCreateAutocmdEvents(['filetype', 'FileType'])).toEqual([
      'FileType',
    ])
  })

  it('preserves canonical User* custom events', () => {
    expect(normalizeCreateAutocmdEvents(['UserMyEvent'])).toEqual([
      'UserMyEvent',
    ])
  })

  it('does not preserve lowercase user* custom events', () => {
    expect(normalizeCreateAutocmdEvents(['userMyEvent'])).toEqual([])
  })

  it('keeps catalog event normalization unchanged with User* events', () => {
    expect(normalizeCreateAutocmdEvents(['bufenter', 'UserMyEvent'])).toEqual([
      'BufEnter',
      'UserMyEvent',
    ])
  })

  it('deduplicates events case-insensitively', () => {
    expect(
      normalizeCreateAutocmdEvents([
        'BufEnter',
        'bufenter',
        'BUFENTER',
        'BufLeave',
        'bufleave',
      ]),
    ).toEqual(['BufEnter', 'BufLeave'])
  })

  it('filters out unknown/invalid events', () => {
    expect(
      normalizeCreateAutocmdEvents([
        'BufEnter',
        'UnknownEvent',
        'AnotherFakeEvent',
      ]),
    ).toEqual(['BufEnter'])
    expect(normalizeCreateAutocmdEvents(['Invalid123', ''])).toEqual([])
  })

  it('allows empty result when all events are invalid', () => {
    expect(normalizeCreateAutocmdEvents(['NotAnEvent', 'AnotherFake'])).toEqual(
      [],
    )
    expect(normalizeCreateAutocmdEvents([])).toEqual([])
  })

  it('normalizes mixed-case events to canonical names', () => {
    const input = [
      'bufnewfile',
      'BUFREADPRE',
      'BufWritePost',
      'FILETYPE',
      'vimenter',
      'LSPATTACH',
    ]
    expect(normalizeCreateAutocmdEvents(input)).toEqual([
      'BufNewFile',
      'BufReadPre',
      'BufWritePost',
      'FileType',
      'VimEnter',
      'LspAttach',
    ])
  })

  it('preserves order of first occurrence for deduplication', () => {
    expect(
      normalizeCreateAutocmdEvents([
        'BufLeave',
        'BufEnter',
        'bufleave',
        'bufenter',
      ]),
    ).toEqual(['BufLeave', 'BufEnter'])
  })

  it('filters out empty strings and whitespace-only', () => {
    expect(
      normalizeCreateAutocmdEvents(['BufEnter', '', '   ', 'BufLeave']),
    ).toEqual(['BufEnter', 'BufLeave'])
  })
})

describe('create-autocmd event config normalization', () => {
  it('preserves explicit empty events array', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: [],
        patterns: ['*.lua'],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.events).toEqual([])
  })

  it('uses default events when events field is missing', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        patterns: ['*.lua'],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.events).toEqual(['BufEnter'])
  })

  it('uses default events when events field has invalid shape', () => {
    const config = getNormalizedActionConfig(
      buildGraphWithActionNode({
        actionConfigType: 'create-autocmd',
        events: 'BufReadPost',
        patterns: ['*.lua'],
        callbackLua: '',
        groupName: '',
        once: false,
        nested: false,
      }),
    )

    expect(config.events).toEqual(['BufEnter'])
  })
})

describe('buildConditionExpression', () => {
  it('builds expression from builder fields', () => {
    expect(buildConditionExpression('a', '==', 'b')).toBe('a == b')
    expect(buildConditionExpression('5', '>', '10')).toBe('5 > 10')
    expect(buildConditionExpression('x', '~=', 'y')).toBe('x ~= y')
  })

  it('returns empty string when either side is empty', () => {
    expect(buildConditionExpression('', '==', 'b')).toBe('')
    expect(buildConditionExpression('a', '==', '')).toBe('')
    expect(buildConditionExpression('', '==', '')).toBe('')
  })

  it('trims whitespace', () => {
    expect(buildConditionExpression('  a  ', '==', '  b  ')).toBe('a == b')
  })
})

function buildGraphWithConditionData(conditionData: unknown): Graph {
  return {
    id: 'graph-1',
    name: 'Test Graph',
    nodes: [
      {
        id: 'node-condition-1',
        type: 'condition',
        definitionId: 'condition.default',
        position: { x: 0, y: 0 },
        data: conditionData as ConditionNodeData,
      },
    ],
    edges: [],
    createdAt: 1,
    updatedAt: 1,
    enabled: true,
    order: 0,
  }
}

function getNormalizedConditionNode(
  graph: Graph,
): GraphNode<ConditionNodeData> {
  const normalizedGraph = normalizeGraphForEditor(graph)
  const node = normalizedGraph.nodes[0]

  if (!node || node.data.nodeType !== 'condition') {
    throw new Error('Expected first node to be a condition node')
  }

  return node as GraphNode<ConditionNodeData>
}

describe('normalizeGraphForEditor condition normalization', () => {
  it('normalizes displayName in condition nodes', () => {
    const node = getNormalizedConditionNode(
      buildGraphWithConditionData({
        nodeType: 'condition',
        operator: '==',
        hardcodedA: '',
        hardcodedB: '',
        displayName: '  Check Filetype  ',
      }),
    )

    expect(node.data.displayName).toBe('Check Filetype')
  })

  it('preserves builder fields in condition nodes', () => {
    const node = getNormalizedConditionNode(
      buildGraphWithConditionData({
        nodeType: 'condition',
        operator: '>',
        hardcodedA: '5',
        hardcodedB: '10',
      }),
    )

    expect(node.data.operator).toBe('>')
    expect(node.data.hardcodedA).toBe('5')
    expect(node.data.hardcodedB).toBe('10')
  })
})
