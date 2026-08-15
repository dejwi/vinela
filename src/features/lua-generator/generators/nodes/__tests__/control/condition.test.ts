// src/features/lua-generator/generators/nodes/__tests__/control/condition.test.ts
// Tests for condition node generator

import { describe, expect, it } from 'vitest'
import type { ConditionNodeData, GraphNode } from '@/shared/types'
import { conditionGenerator } from '../../control/condition'
import { createMockContext } from '../helpers/mock-context'

function createConditionNode(
  id: string,
  operator: ConditionNodeData['operator'],
  hardcodedA: string,
  hardcodedB: string,
): GraphNode<ConditionNodeData> {
  return {
    id,
    type: 'condition',
    definitionId: `condition-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'condition',
      operator,
      hardcodedA,
      hardcodedB,
    },
  }
}

describe('conditionGenerator', () => {
  it('should generate if-then-end for true branch only', () => {
    const node = createConditionNode('cond1', '>', '10', '5')

    const { context, getEmittedDiagnostics } = createMockContext({
      inputBindings: {
        a: '10',
        b: '5',
      },
      renderExecFromPort: (_nodeId, portId) => {
        if (portId === 'true') {
          return ['print("greater")']
        }
        return []
      },
    })

    const unit = conditionGenerator.generate(node, context)

    expect(unit.nodeId).toBe('cond1')
    expect(unit.nodeType).toBe('condition')
    expect(unit.code).toContain('if 10 > 5 then')
    expect(unit.code).toContain('  print("greater")')
    expect(unit.code).toContain('end')
    expect(getEmittedDiagnostics()).toHaveLength(0)
  })

  it('should generate if-then-else-end for both branches', () => {
    const node = createConditionNode('cond2', '==', 'x', 'y')

    const { context, getEmittedDiagnostics } = createMockContext({
      inputBindings: {
        a: 'x',
        b: 'y',
      },
      renderExecFromPort: (_nodeId, portId) => {
        if (portId === 'true') {
          return ['print("equal")']
        }
        if (portId === 'false') {
          return ['print("not equal")']
        }
        return []
      },
    })

    const unit = conditionGenerator.generate(node, context)

    expect(unit.code).toContain('if x == y then')
    expect(unit.code).toContain('  print("equal")')
    expect(unit.code).toContain('else')
    expect(unit.code).toContain('  print("not equal")')
    expect(unit.code).toContain('end')
    expect(getEmittedDiagnostics()).toHaveLength(0)
  })

  it('should generate if-not-then-end for false branch only', () => {
    const node = createConditionNode('cond3', '~=', 'a', 'b')

    const { context, getEmittedDiagnostics } = createMockContext({
      inputBindings: {
        a: 'a',
        b: 'b',
      },
      renderExecFromPort: (_nodeId, portId) => {
        if (portId === 'false') {
          return ['print("same")']
        }
        return []
      },
    })

    const unit = conditionGenerator.generate(node, context)

    expect(unit.code).toContain('if not (a ~= b) then')
    expect(unit.code).toContain('  print("same")')
    expect(unit.code).toContain('end')
    expect(getEmittedDiagnostics()).toHaveLength(0)
  })

  it('should emit warning for empty branches', () => {
    const node = createConditionNode('cond4', '<', '1', '2')

    const { context, getEmittedDiagnostics } = createMockContext({
      inputBindings: {
        a: '1',
        b: '2',
      },
      renderExecFromPort: () => [],
    })

    const unit = conditionGenerator.generate(node, context)

    expect(unit.code).toContain('if 1 < 2 then')
    expect(unit.code).toContain('end')

    const diagnostics = getEmittedDiagnostics()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.id).toBe('condition-empty-branches')
    expect(diagnostics[0]?.severity).toBe('warning')
  })

  it('should emit error for missing input a', () => {
    // Empty hardcodedA means no fallback — a connected input is required
    const node = createConditionNode('cond5', '>=', '', '10')

    const { context, diagnostics } = createMockContext({
      inputBindings: {
        b: '10',
      },
    })

    const unit = conditionGenerator.generate(node, context)

    expect(unit.code).toHaveLength(0)
    expect(diagnostics.hasErrors()).toBe(true)

    const errors = diagnostics.getErrors()
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(
      errors.some(
        (e) => e.id === 'node-missing-input' && e.source?.portId === 'a',
      ),
    ).toBe(true)
  })

  it('should emit error for missing input b', () => {
    // Empty hardcodedB means no fallback — a connected input is required
    const node = createConditionNode('cond6', '<=', '5', '')

    const { context, diagnostics } = createMockContext({
      inputBindings: {
        a: '5',
      },
    })

    const unit = conditionGenerator.generate(node, context)

    expect(unit.code).toHaveLength(0)
    expect(diagnostics.hasErrors()).toBe(true)

    const errors = diagnostics.getErrors()
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(
      errors.some(
        (e) => e.id === 'node-missing-input' && e.source?.portId === 'b',
      ),
    ).toBe(true)
  })

  it('should support all condition operators', () => {
    const operators: ConditionNodeData['operator'][] = [
      '==',
      '~=',
      '>',
      '>=',
      '<',
      '<=',
    ]

    for (const operator of operators) {
      const node = createConditionNode(`cond-${operator}`, operator, 'x', 'y')

      const { context } = createMockContext({
        inputBindings: {
          a: 'x',
          b: 'y',
        },
        renderExecFromPort: (_nodeId, portId) => {
          return portId === 'true' ? ['print("true")'] : []
        },
      })

      const unit = conditionGenerator.generate(node, context)

      expect(unit.code.some((line) => line.includes(operator))).toBe(true)
    }
  })
})
