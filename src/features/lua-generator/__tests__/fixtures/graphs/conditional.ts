/**
 * Conditional Branching Graph Fixture
 *
 * Tests condition nodes with true/false branches.
 */

import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { GraphBuilder } from '../../utils/graph-builder'

/**
 * Conditional graph with true/false branches:
 *
 *                    ┌──────────────┐
 * OnStartup ───────▶│  Condition   │
 *                   │    x > 5     │
 *                   └───────┬──────┘
 *                    (true) │ (false)
 *                           │
 *         ┌─────────────────┴─────────────┐
 *         ▼                                 ▼
 * ┌───────────────┐              ┌──────────────┐
 │   Print High  │              │  Print Low   │
 * └───────────────┘              └──────────────┘
 *         │                                 │
 *         └─────────────────┬───────────────┘
 *                           ▼
 *                    ┌──────────────┐
                    │    Merge     │
 *                    └──────────────┘
 */
export const conditionalGraph: Graph = new GraphBuilder(
  'conditional',
  'conditional',
)
  .startupTrigger('entry', 'On Startup')
  .condition('cond1', '>', 'x', '5', 'Is x > 5?')
  // True branch
  .action(
    'printHigh',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "High value"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Print High',
  )
  // False branch
  .action(
    'printLow',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Low value"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Print Low',
  )
  // Connect entry to condition
  .connectExec('entry', 'cond1')
  // Connect branches
  .connectTrue('cond1', 'printHigh')
  .connectFalse('cond1', 'printLow')
  .build()

/**
 * Nested conditions graph.
 */
export const nestedConditionalGraph: Graph = new GraphBuilder(
  'nested-conditional',
  'nested-conditional',
)
  .startupTrigger('entry', 'On Startup')
  // Outer condition
  .condition('outer', '==', 'mode', '"visual"', 'In visual mode?')
  // Inner condition (on true branch)
  .condition('inner', '==', 'selection', '"block"', 'Block selection?')
  // Actions
  .action(
    'visualBlock',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Visual block"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Visual Block Action',
  )
  .action(
    'visualLine',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Visual line"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Visual Line Action',
  )
  .action(
    'normalAction',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Normal mode"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Normal Mode Action',
  )
  // Connect entry to outer
  .connectExec('entry', 'outer')
  // Connect nested structure
  .connectTrue('outer', 'inner')
  .connectTrue('inner', 'visualBlock')
  .connectFalse('inner', 'visualLine')
  .connectFalse('outer', 'normalAction')
  .build()

/**
 * Condition with comparison operators.
 */
export const comparisonOperatorsGraph: Graph = new GraphBuilder(
  'comparison-ops',
  'comparison-ops',
)
  .startupTrigger('entry', 'On Startup')
  // Various operators
  .condition('eq', '==', 'a', 'b', 'Equal')
  .condition('ne', '~=', 'c', 'd', 'Not Equal')
  .condition('gt', '>', 'e', 'f', 'Greater Than')
  .condition('gte', '>=', 'g', 'h', 'Greater Than or Equal')
  .condition('lt', '<', 'i', 'j', 'Less Than')
  .condition('lte', '<=', 'k', 'l', 'Less Than or Equal')
  // Connect sequentially for testing
  .connectExec('entry', 'eq')
  .connectExec('eq', 'ne')
  .connectExec('ne', 'gt')
  .connectExec('gt', 'gte')
  .connectExec('gte', 'lt')
  .connectExec('lt', 'lte')
  .build()
