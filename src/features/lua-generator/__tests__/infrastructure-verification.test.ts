/**
 * Verification tests for test utilities and fixtures
 *
 * These tests verify that the test infrastructure works correctly.
 */

import { describe, expect, it } from 'vitest'
import { allNodesGraph } from './fixtures/graphs/all-nodes'
import { callableGraph } from './fixtures/graphs/callable'
import { conditionalGraph } from './fixtures/graphs/conditional'
import { forLoopGraph } from './fixtures/graphs/loop-types'
import {
  simpleSetOptionGraph,
  simpleStartupGraph,
} from './fixtures/graphs/simple-startup'
import { complexProject } from './fixtures/projects/complex'
import { minimalProject } from './fixtures/projects/minimal'
import { createCallablePort, GraphBuilder } from './utils/graph-builder'
import { normalizeLuaForSnapshot } from './utils/snapshot'
import type { ProjectFixture } from './utils/temp-project'
import { createEmptyFixture } from './utils/temp-project'

describe('GraphBuilder', () => {
  it('can build a simple graph', () => {
    const graph = new GraphBuilder('test-graph')
      .startupTrigger('entry')
      .action('action1', 'set-option', {
        actionConfigType: 'set-option',
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      })
      .connectExec('entry', 'action1')
      .build()

    expect(graph.id).toBeDefined()
    expect(graph.name).toBe('test-graph')
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.nodes[0]?.data.nodeType).toBe('trigger')
    expect(graph.nodes[1]?.data.nodeType).toBe('action')
  })

  it('can create callable graphs', () => {
    const graph = new GraphBuilder('callable-test')
      .callableEntry('entry', [createCallablePort('x', 'X', 'number')])
      .action('process', 'run-action', {
        actionConfigType: 'run-action',
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo test',
        selectedActionKey: '',
        paramValues: {},
      })
      .returnNode('ret', [createCallablePort('y', 'Y', 'number')])
      .connectExec('entry', 'process')
      .connectExec('process', 'ret')
      .build()

    const entryNode = graph.nodes.find(
      (n) => n.data.nodeType === 'callable-entry',
    )
    expect(entryNode).toBeDefined()
    expect(graph.nodes.find((n) => n.data.nodeType === 'return')).toBeDefined()
  })

  it('can create conditional graphs', () => {
    const graph = new GraphBuilder('condition-test')
      .startupTrigger('entry')
      .condition('cond', '>', 'a', 'b')
      .action('trueAction', 'run-action', {
        actionConfigType: 'run-action',
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo true',
        selectedActionKey: '',
        paramValues: {},
      })
      .action('falseAction', 'run-action', {
        actionConfigType: 'run-action',
        mode: 'custom-command',
        actionType: 'command',
        action: 'echo false',
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('entry', 'cond')
      .connectTrue('cond', 'trueAction')
      .connectFalse('cond', 'falseAction')
      .build()

    expect(graph.nodes).toHaveLength(4)
    expect(graph.edges).toHaveLength(3)
  })

  it('can create loop graphs', () => {
    const graph = new GraphBuilder('loop-test')
      .startupTrigger('entry')
      .loop('for1', 'for', 'i', '1, 10')
      .action('body', 'run-action', {
        actionConfigType: 'run-action',
        mode: 'custom-command',
        actionType: 'command',
        action: `echo \${i}`,
        selectedActionKey: '',
        paramValues: {},
      })
      .connectExec('entry', 'for1')
      .connectLoopBody('for1', 'body')
      .build()

    expect(graph.nodes).toHaveLength(3)
    const bodyNode = graph.nodes.find((n) => n.id === 'body')
    expect(bodyNode).toBeDefined()
    expect(bodyNode?.data.nodeType).toBe('action')
    if (bodyNode?.data.nodeType === 'action') {
      const actionConfig = bodyNode.data.actionConfig
      if (actionConfig.actionConfigType === 'run-action') {
        expect(actionConfig.action).toBe(`echo \${i}`)
      }
    }
    expect(graph.nodes.some((n) => n.data.nodeType === 'loop')).toBe(true)
  })

  it('supports fluent chaining', () => {
    const graph = new GraphBuilder('chain-test')
      .startupTrigger('entry')
      .action('a1', 'set-option', {
        actionConfigType: 'set-option',
        optionName: 'wrap',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: false },
      })
      .action('a2', 'set-keymap', {
        actionConfigType: 'set-keymap',
        modes: ['n'],
        keySequence: '<leader>x',
        command: ':echo test<CR>',
        description: 'Test',
        silent: true,
        noremap: true,
        expr: false,
        showInKeymaps: true,
      })
      .codeBlock('code', 'local x = 1')
      .connectExec('entry', 'a1')
      .connectExec('a1', 'a2')
      .connectExec('a2', 'code')
      .withDescription('Test chain')
      .withEnabled(true)
      .withOrder(5)
      .build()

    expect(graph.nodes).toHaveLength(4)
    expect(graph.description).toBe('Test chain')
    expect(graph.enabled).toBe(true)
    expect(graph.order).toBe(5)
  })
})

describe('Graph Fixtures', () => {
  it('simpleStartupGraph is valid', () => {
    expect(simpleStartupGraph.id).toBe('simple-startup')
    expect(simpleStartupGraph.nodes).toHaveLength(2)
    expect(simpleStartupGraph.nodes[0]?.data.nodeType).toBe('trigger')
    expect(simpleStartupGraph.nodes[1]?.data.nodeType).toBe('action')
  })

  it('simpleSetOptionGraph has correct action type', () => {
    const actionNode = simpleSetOptionGraph.nodes.find(
      (n) => n.data.nodeType === 'action',
    )
    expect(actionNode).toBeDefined()
    expect(actionNode?.data.nodeType).toBe('action')
  })

  it('conditionalGraph has condition node', () => {
    const conditionNode = conditionalGraph.nodes.find(
      (n) => n.data.nodeType === 'condition',
    )
    expect(conditionNode).toBeDefined()
  })

  it('forLoopGraph has loop node', () => {
    const loopNode = forLoopGraph.nodes.find((n) => n.data.nodeType === 'loop')
    expect(loopNode).toBeDefined()
  })

  it('callableGraph preserves literal placeholder strings in fixture actions', () => {
    const processNode = callableGraph.nodes.find((n) => n.id === 'process')
    expect(processNode).toBeDefined()
    if (processNode?.data.nodeType === 'action') {
      const actionConfig = processNode.data.actionConfig
      if (actionConfig.actionConfigType === 'run-action') {
        expect(actionConfig.action).toBe(`echo "Processing: \${message}"`)
      }
    }
  })

  it('forLoopGraph preserves literal placeholder strings in fixture actions', () => {
    const printNode = forLoopGraph.nodes.find((n) => n.id === 'printI')
    expect(printNode).toBeDefined()
    if (printNode?.data.nodeType === 'action') {
      const actionConfig = printNode.data.actionConfig
      if (actionConfig.actionConfigType === 'run-action') {
        expect(actionConfig.action).toBe(`echo \${i}`)
      }
    }
  })

  it('callableGraph has callable entry and return', () => {
    const entryNode = callableGraph.nodes.find(
      (n) => n.data.nodeType === 'callable-entry',
    )
    const returnNode = callableGraph.nodes.find(
      (n) => n.data.nodeType === 'return',
    )
    expect(entryNode).toBeDefined()
    expect(returnNode).toBeDefined()
  })

  it('allNodesGraph contains all node types', () => {
    const nodeTypes = new Set(allNodesGraph.nodes.map((n) => n.data.nodeType))
    expect(nodeTypes.has('trigger')).toBe(true)
    expect(nodeTypes.has('action')).toBe(true)
    expect(nodeTypes.has('condition')).toBe(true)
    expect(nodeTypes.has('loop')).toBe(true)
    expect(nodeTypes.has('code-block')).toBe(true)
    expect(nodeTypes.has('callable-entry')).toBe(true)
    expect(nodeTypes.has('return')).toBe(true)
    expect(nodeTypes.has('graph-ref')).toBe(true)
    expect(nodeTypes.has('run-function')).toBe(true)
    expect(nodeTypes.has('builtin')).toBe(true)
  })
})

describe('Project Fixtures', () => {
  it('minimalProject has required structure', () => {
    expect(minimalProject.project.id).toBe('minimal-project')
    expect(minimalProject.graphs).toHaveLength(1)
    expect(minimalProject.options.version).toBe(1)
    expect(minimalProject.lsp.enabledServers).toEqual([])
  })

  it('complexProject has all components', () => {
    expect(complexProject.project.id).toBe('complex-project')
    expect(complexProject.graphs.length).toBeGreaterThan(1)
    expect(complexProject.plugins.length).toBeGreaterThan(0)
    expect(complexProject.keymaps.length).toBeGreaterThan(0)
    expect(complexProject.lsp.enabledServers.length).toBeGreaterThan(0)
  })

  it('createEmptyFixture creates valid empty fixture', () => {
    const fixture: ProjectFixture = createEmptyFixture('Test')
    expect(fixture.project.name).toBe('Test')
    expect(fixture.graphs).toEqual([])
    expect(fixture.plugins).toEqual([])
    expect(fixture.keymaps).toEqual([])
    expect(fixture.options.options).toEqual({})
    expect(fixture.lsp.enabledServers).toEqual([])
  })
})

describe('Snapshot Utility', () => {
  it('normalizeLuaForSnapshot handles line endings', () => {
    const code = 'line1\r\nline2\rline3'
    const normalized = normalizeLuaForSnapshot(code)
    expect(normalized).toBe('line1\nline2\nline3')
  })

  it('normalizeLuaForSnapshot trims trailing whitespace', () => {
    const code = 'line1   \nline2\t\nline3'
    const normalized = normalizeLuaForSnapshot(code)
    expect(normalized).toBe('line1\nline2\nline3')
  })

  it('createStableSnapshot removes timestamps', () => {
    const code = `-- Generated 2024-01-01
local x = 1
-- Version 1.0.0
local y = 2`
    const normalized = normalizeLuaForSnapshot(code, {
      removeLinePatterns: [/--\s*Generated/, /--\s*Version/],
    })
    expect(normalized).not.toContain('Generated')
    expect(normalized).not.toContain('Version')
    expect(normalized).toContain('local x = 1')
    expect(normalized).toContain('local y = 2')
  })
})

describe('createCallablePort', () => {
  it('creates port with all fields', () => {
    const port = createCallablePort('id1', 'Name', 'string', 'Description')
    expect(port.id).toBe('id1')
    expect(port.name).toBe('Name')
    expect(port.dataType).toBe('string')
    expect(port.description).toBe('Description')
  })

  it('creates port without description', () => {
    const port = createCallablePort('id1', 'Name', 'number')
    expect(port.id).toBe('id1')
    expect(port.name).toBe('Name')
    expect(port.dataType).toBe('number')
    expect('description' in port).toBe(false)
  })

  it('defaults to any data type', () => {
    const port = createCallablePort('id1', 'Name')
    expect(port.dataType).toBe('any')
  })
})
