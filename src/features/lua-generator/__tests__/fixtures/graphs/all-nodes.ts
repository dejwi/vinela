/**
 * All Nodes Graph Fixture
 *
 * Contains one of each node type for smoke testing.
 * This is a comprehensive fixture covering all generator targets.
 */

import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { createCallablePort, GraphBuilder } from '../../utils/graph-builder'

/**
 * Graph containing all node types.
 * Not a meaningful execution flow, but covers all node types.
 */
export const allNodesGraph: Graph = new GraphBuilder('all-nodes', 'all-nodes')
  // Triggers
  .startupTrigger('startup', 'Startup Trigger')

  // Callable entry
  .callableEntry(
    'callable',
    [createCallablePort('input', 'Input', 'string')],
    'Callable Entry',
  )

  // Actions - all 7 core types
  .action(
    'setOption',
    'set-option',
    {
      ...createDefaultActionConfig('set-option'),
      optionName: 'number',
      scope: 'global',
      valueConfig: {
        valueMode: 'suggested',
        suggestedValue: true,
      },
    },
    'Set Option',
  )
  .action(
    'runAction',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: ':echo "Test"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Run Action',
  )
  .action(
    'setKeymap',
    'set-keymap',
    {
      ...createDefaultActionConfig('set-keymap'),
      modes: ['n'],
      keySequence: '<leader>t',
      command: ':echo "Test"<CR>',
      description: 'Test keymap',
      silent: true,
      noremap: true,
      expr: false,
      showInKeymaps: true,
    },
    'Set Keymap',
  )
  .action(
    'setVariable',
    'set-variable',
    {
      ...createDefaultActionConfig('set-variable'),
      scope: 'g',
      variableName: 'test_var',
      valueType: 'string',
      value: 'test_value',
    },
    'Set Variable',
  )
  .action(
    'getVariable',
    'get-variable',
    {
      ...createDefaultActionConfig('get-variable'),
      scope: 'g',
      variableName: 'test_var',
    },
    'Get Variable',
  )
  .action(
    'createAutocmd',
    'create-autocmd',
    {
      ...createDefaultActionConfig('create-autocmd'),
      events: ['BufEnter'],
      patterns: ['*'],
      callbackLua: 'print("Buffer entered")',
      groupName: 'TestGroup',
      once: false,
      nested: false,
    },
    'Create Autocmd',
  )
  .action(
    'setHighlight',
    'set-highlight',
    {
      ...createDefaultActionConfig('set-highlight'),
      groupName: 'TestHighlight',
      foreground: '#ff0000',
      background: '#000000',
      bold: true,
      italic: false,
      underline: false,
    },
    'Set Highlight',
  )

  // Condition
  .condition('condition', '==', 'a', 'b', 'Condition')

  // Loops - all 3 types
  .loop('forLoop', 'for', 'i', '1, 10', 'For Loop')
  .loop('whileLoop', 'while', '_', 'true', 'While Loop')
  .loop('eachLoop', 'each', 'item', 'items', 'Each Loop')

  // Code Block
  .codeBlock(
    'codeBlock',
    'local x = 1\nreturn x',
    [{ id: 'in1', name: 'Input', dataType: 'number' }],
    [{ id: 'out1', name: 'Output', dataType: 'number' }],
    'Code Block',
  )

  // Graph Ref
  .graphRef('graphRef', 'target-graph', 'Call Graph')

  // Run Function
  .runFunction(
    'runFunction',
    'vim.lsp.buf.hover',
    { type: 'core', functionName: 'vim.lsp.buf.hover' },
    'Run Function',
  )

  // Builtin
  .builtin('builtin', 'treesitter', { highlight: { enable: true } }, 'Builtin')

  // Return
  .returnNode(
    'return',
    [createCallablePort('output', 'Output', 'any')],
    'Return',
  )

  .withDescription('Graph containing all node types for testing')
  .build()

/**
 * Minimal all-nodes graph (just essential types).
 */
export const minimalAllNodesGraph: Graph = new GraphBuilder(
  'minimal-all-nodes',
  'minimal-all-nodes',
)
  .startupTrigger('startup', 'Startup')
  .action(
    'action1',
    'set-option',
    {
      ...createDefaultActionConfig('set-option'),
      optionName: 'wrap',
      scope: 'global',
      valueConfig: {
        valueMode: 'suggested',
        suggestedValue: false,
      },
    },
    'Action',
  )
  .condition('cond', '==', 'x', 'y', 'Condition')
  .loop('loop', 'for', 'i', '1, 5', 'Loop')
  .codeBlock('code', 'print("hello")', [], [], 'Code')
  .returnNode('ret', [], 'Return')
  .connectExec('startup', 'action1')
  .connectExec('action1', 'cond')
  .connectExec('cond', 'loop')
  .connectExec('loop', 'code')
  .connectExec('code', 'ret')
  .build()
