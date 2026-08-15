/**
 * Loop Types Graph Fixture
 *
 * Tests various loop constructs: for, while, each.
 */

import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { GraphBuilder } from '../../utils/graph-builder'

/**
 * For loop graph:
 * for i = 1, 10 do
 *   print(i)
 * end
 */
export const forLoopGraph: Graph = new GraphBuilder('for-loop', 'for-loop')
  .startupTrigger('entry', 'On Startup')
  .loop('for1', 'for', 'i', '1, 10', 'Count to 10')
  .action(
    'printI',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo \${i}`,
      selectedActionKey: '',
      paramValues: {},
    },
    'Print i',
  )
  .action(
    'afterLoop',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Done"',
      selectedActionKey: '',
      paramValues: {},
    },
    'After Loop',
  )
  .connectLoopBody('for1', 'printI')
  .connectLoopComplete('for1', 'afterLoop')
  .connectExec('entry', 'for1')
  .build()

/**
 * While loop graph:
 * while condition do
 *   -- body
 * end
 */
export const whileLoopGraph: Graph = new GraphBuilder(
  'while-loop',
  'while-loop',
)
  .startupTrigger('entry', 'On Startup')
  .loop('while1', 'while', '_', 'not_finished()', 'While not finished')
  .action(
    'doWork',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Working..."',
      selectedActionKey: '',
      paramValues: {},
    },
    'Do Work',
  )
  .connectLoopBody('while1', 'doWork')
  .connectExec('entry', 'while1')
  .build()

/**
 * Each loop graph (iteration):
 * for _, item in ipairs(items) do
 *   print(item)
 * end
 */
export const eachLoopGraph: Graph = new GraphBuilder('each-loop', 'each-loop')
  .startupTrigger('entry', 'On Startup')
  .loop('each1', 'each', 'item', 'items', 'Iterate items')
  .action(
    'processItem',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo "Processing: \${item}"`,
      selectedActionKey: '',
      paramValues: {},
    },
    'Process Item',
  )
  .action(
    'doneProcessing',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "All items processed"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Done Processing',
  )
  .connectLoopBody('each1', 'processItem')
  .connectLoopComplete('each1', 'doneProcessing')
  .connectExec('entry', 'each1')
  .build()

/**
 * Graph with all loop types combined.
 */
export const allLoopTypesGraph: Graph = new GraphBuilder(
  'all-loops',
  'all-loops',
)
  .startupTrigger('entry', 'On Startup')
  // For loop
  .loop('forLoop', 'for', 'i', '1, 5', 'For 1 to 5')
  .action(
    'forBody',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo "For: \${i}"`,
      selectedActionKey: '',
      paramValues: {},
    },
    'For Body',
  )
  // While loop (after for completes)
  .loop('whileLoop', 'while', '_', 'condition', 'While condition')
  .action(
    'whileBody',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "While body"',
      selectedActionKey: '',
      paramValues: {},
    },
    'While Body',
  )
  // Each loop (after while completes)
  .loop('eachLoop', 'each', 'v', 'values', 'Each value')
  .action(
    'eachBody',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo "Each: \${v}"`,
      selectedActionKey: '',
      paramValues: {},
    },
    'Each Body',
  )
  // Connections
  .connectExec('entry', 'forLoop')
  .connectLoopBody('forLoop', 'forBody')
  .connectLoopComplete('forLoop', 'whileLoop')
  .connectLoopBody('whileLoop', 'whileBody')
  .connectLoopComplete('whileLoop', 'eachLoop')
  .connectLoopBody('eachLoop', 'eachBody')
  .build()
