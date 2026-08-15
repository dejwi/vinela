import { describe, expect, it } from 'vitest'
import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import { createDefaultActionConfig } from '@/shared/types'
import { generateAllGraphs } from '../graph-generation'

describe('generateAllGraphs', () => {
  it('generates callable graphs', () => {
    const callableGraph = new GraphBuilder('Callable Graph', 'callable-graph')
      .callableEntry('entry', [createCallablePort('name', 'Name', 'string')])
      .action('setVar', 'set-variable', {
        ...createDefaultActionConfig('set-variable'),
        scope: 'g',
        variableName: 'callable_name',
        valueType: 'string',
        value: 'generated',
      })
      .returnNode('ret', [createCallablePort('result', 'Result', 'string')])
      .connectExec('entry', 'setVar')
      .connectExec('setVar', 'ret')
      .build()

    const collector = new DiagnosticsCollector()
    const result = generateAllGraphs([callableGraph], collector)

    expect(
      result.callableUnits.some((unit) => unit.nodeType === 'callable-entry'),
    ).toBe(true)
    expect(result.startupUnits).toHaveLength(0)

    const entryUnit = result.callableUnits.find(
      (unit) => unit.nodeType === 'callable-entry',
    )
    expect(entryUnit?.code.join('\n')).toContain('_G._vinela_callables')
  })

  it('generates startup graphs', () => {
    const startupGraph = new GraphBuilder('Startup Graph', 'startup-graph')
      .startupTrigger('entry')
      .action('setNumber', 'set-option', {
        ...createDefaultActionConfig('set-option'),
        optionName: 'number',
        scope: 'global',
        valueConfig: {
          valueMode: 'suggested',
          suggestedValue: true,
        },
      })
      .connectExec('entry', 'setNumber')
      .build()

    const collector = new DiagnosticsCollector()
    const result = generateAllGraphs([startupGraph], collector)

    expect(
      result.startupUnits.some((unit) => unit.nodeType === 'trigger'),
    ).toBe(true)
    expect(result.callableUnits).toHaveLength(0)
  })

  it('respects graph disable states', () => {
    const enabledStartupGraph = new GraphBuilder(
      'Enabled Graph',
      'enabled-graph',
    )
      .startupTrigger('enabled-entry')
      .build()

    const disabledStartupGraph = new GraphBuilder(
      'Disabled Graph',
      'disabled-graph',
    )
      .startupTrigger('disabled-entry')
      .withEnabled(false)
      .build()

    const collector = new DiagnosticsCollector()
    const result = generateAllGraphs(
      [enabledStartupGraph, disabledStartupGraph],
      collector,
    )

    expect(
      result.startupUnits.some((unit) => unit.nodeId === 'enabled-entry'),
    ).toBe(true)
    expect(
      result.startupUnits.some((unit) => unit.nodeId === 'disabled-entry'),
    ).toBe(false)
  })

  it('builds callable contracts', () => {
    const callableGraph = new GraphBuilder('Contract Graph', 'contract-graph')
      .callableEntry('entry', [createCallablePort('input', 'Input', 'string')])
      .returnNode('ret', [createCallablePort('output', 'Output', 'number')])
      .build()

    const collector = new DiagnosticsCollector()
    const result = generateAllGraphs([callableGraph], collector)
    const contract = result.callableContracts.get('contract-graph')

    expect(contract).toBeDefined()
    expect(contract?.graphId).toBe('contract-graph')
    expect(contract?.parameters).toHaveLength(1)
    expect(contract?.returnValues).toHaveLength(1)
  })
})
