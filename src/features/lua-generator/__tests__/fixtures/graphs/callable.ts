/**
 * Callable Graph Fixture
 *
 * Tests callable graphs with parameters and return values.
 */

import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import { createCallablePort, GraphBuilder } from '../../utils/graph-builder'

/**
 * Simple callable graph:
 * Parameters: message (string)
 * Returns: result (string)
 *
 * Callable Entry (message) → Process → Return (result)
 */
export const callableGraph: Graph = new GraphBuilder(
  'callable-graph',
  'callable-graph',
)
  .callableEntry(
    'entry',
    [createCallablePort('message', 'Message', 'string')],
    'Process Message',
  )
  .action(
    'process',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo "Processing: \${message}"`,
      selectedActionKey: '',
      paramValues: {},
    },
    'Process',
  )
  .returnNode(
    'return1',
    [createCallablePort('result', 'Result', 'string')],
    'Return Result',
  )
  .connectExec('entry', 'process')
  .connectExec('process', 'return1')
  .withDescription('A callable graph that processes a message')
  .build()

/**
 * Callable graph with multiple parameters.
 */
export const multiParamCallableGraph: Graph = new GraphBuilder(
  'multi-param-callable',
  'multi-param-callable',
)
  .callableEntry(
    'entry',
    [
      createCallablePort('x', 'X', 'number'),
      createCallablePort('y', 'Y', 'number'),
      createCallablePort('operation', 'Operation', 'string'),
    ],
    'Calculate',
  )
  .action(
    'calculate',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo "\${x} \${operation} \${y}"`,
      selectedActionKey: '',
      paramValues: {},
    },
    'Calculate',
  )
  .returnNode(
    'return1',
    [createCallablePort('result', 'Result', 'number')],
    'Return Result',
  )
  .connectExec('entry', 'calculate')
  .connectExec('calculate', 'return1')
  .build()

/**
 * Callable graph with condition inside.
 */
export const callableWithConditionGraph: Graph = new GraphBuilder(
  'callable-with-condition',
  'callable-with-condition',
)
  .callableEntry(
    'entry',
    [createCallablePort('value', 'Value', 'number')],
    'Process Value',
  )
  .condition('check', '>', 'value', '0', 'Is Positive?')
  .action(
    'positive',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Positive"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Handle Positive',
  )
  .action(
    'negative',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Negative or Zero"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Handle Negative',
  )
  .returnNode(
    'return1',
    [
      createCallablePort('status', 'Status', 'string'),
      createCallablePort('original', 'Original Value', 'number'),
    ],
    'Return',
  )
  .connectTrue('check', 'positive')
  .connectFalse('check', 'negative')
  .connectExec('entry', 'check')
  .connectExec('positive', 'return1')
  .connectExec('negative', 'return1')
  .build()

/**
 * Callable graph with no parameters.
 */
export const noParamsCallableGraph: Graph = new GraphBuilder(
  'no-params-callable',
  'no-params-callable',
)
  .callableEntry('entry', [], 'Get Info')
  .action(
    'getInfo',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: 'echo "Info retrieved"',
      selectedActionKey: '',
      paramValues: {},
    },
    'Get Info',
  )
  .returnNode('return1', [], 'Return')
  .connectExec('entry', 'getInfo')
  .connectExec('getInfo', 'return1')
  .build()

/**
 * Callable graph with no return values (procedure).
 */
export const noReturnCallableGraph: Graph = new GraphBuilder(
  'no-return-callable',
  'no-return-callable',
)
  .callableEntry(
    'entry',
    [createCallablePort('action', 'Action', 'string')],
    'Execute Action',
  )
  .action(
    'execute',
    'run-action',
    {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command',
      actionType: 'command',
      action: `echo "Executing: \${action}"`,
      selectedActionKey: '',
      paramValues: {},
    },
    'Execute',
  )
  // No return node - this is a procedure
  .connectExec('entry', 'execute')
  .build()
