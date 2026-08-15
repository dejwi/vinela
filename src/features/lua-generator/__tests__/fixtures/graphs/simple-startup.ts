/**
 * Simple Startup Graph Fixture
 *
 * A minimal graph with a startup trigger and a single action.
 * Used for basic generation testing.
 */

import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { GraphBuilder } from '../../utils/graph-builder'

/**
 * Simple startup graph:
 * OnStartup → Run Action (echo "Hello, World!")
 */
export const simpleStartupGraph: Graph = new GraphBuilder(
  'simple-startup',
  'simple-startup',
)
  .startupTrigger('entry', 'On Startup')
  .action(
    'action1',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Hello, World!"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Print Message',
  )
  .connectExec('entry', 'action1')
  .withDescription('A simple startup graph for testing')
  .build()

/**
 * Variant with Set Option action.
 */
export const simpleSetOptionGraph: Graph = new GraphBuilder(
  'simple-set-option',
  'simple-set-option',
)
  .startupTrigger('entry', 'On Startup')
  .action(
    'setNumber',
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
    'Enable Line Numbers',
  )
  .connectExec('entry', 'setNumber')
  .build()

/**
 * Variant with Set Keymap action.
 */
export const simpleSetKeymapGraph: Graph = new GraphBuilder(
  'simple-set-keymap',
  'simple-set-keymap',
)
  .startupTrigger('entry', 'On Startup')
  .action(
    'keymap1',
    'set-keymap',
    {
      ...createDefaultActionConfig('set-keymap'),
      modes: ['n'],
      keySequence: '<leader>te',
      command: ':echo "Test"<CR>',
      description: 'Test keymap',
      silent: true,
      noremap: true,
      expr: false,
      showInKeymaps: true,
    },
    'Test Keymap',
  )
  .connectExec('entry', 'keymap1')
  .build()
