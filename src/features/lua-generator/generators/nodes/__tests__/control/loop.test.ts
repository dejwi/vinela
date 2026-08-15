// src/features/lua-generator/generators/nodes/__tests__/control/loop.test.ts
// Tests for loop node generator

import { describe, expect, it } from 'vitest'
import type { GraphNode, LoopNodeData } from '@/shared/types'
import { loopGenerator } from '../../control/loop'
import { createMockContext } from '../helpers/mock-context'

function createLoopNode(
  id: string,
  loopType: LoopNodeData['loopType'],
  iteratorVariable: string,
  iterableExpression: string,
): GraphNode<LoopNodeData> {
  return {
    id,
    type: 'loop',
    definitionId: `loop-${id}`,
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'loop',
      loopType,
      iteratorVariable,
      iterableExpression,
    },
  }
}

describe('loopGenerator', () => {
  describe('for loops', () => {
    it('should generate numeric for loop with start and stop', () => {
      const node = createLoopNode('loop1', 'for', 'i', '1,10')

      const { context } = createMockContext({
        renderExecFromPort: () => ['print(i)'],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('for i = 1, 10 do')
      expect(unit.code).toContain('  print(i)')
      expect(unit.code).toContain('end')
    })

    it('should generate numeric for loop with step', () => {
      const node = createLoopNode('loop2', 'for', 'i', '1,10,2')

      const { context } = createMockContext({
        renderExecFromPort: () => ['print(i)'],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('for i = 1, 10, 2 do')
      expect(unit.code).toContain('  print(i)')
      expect(unit.code).toContain('end')
    })

    it('should sanitize iterator variable name', () => {
      const node = createLoopNode('loop3', 'for', 'my-var', '1,5')

      const { context } = createMockContext({
        renderExecFromPort: () => [],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('for my_var = 1, 5 do')
    })

    it('should fallback to while loop for incomplete for expression', () => {
      const node = createLoopNode('loop4', 'for', 'i', 'counter')

      const { context } = createMockContext({
        renderExecFromPort: () => ['print(i)'],
      })

      const unit = loopGenerator.generate(node, context)

      // Falls back to while loop when expression doesn't have comma
      expect(unit.code).toContain('while counter do')
    })
  })

  describe('while loops', () => {
    it('should generate while loop', () => {
      const node = createLoopNode('loop5', 'while', 'i', 'i < 10')

      const { context } = createMockContext({
        renderExecFromPort: () => ['i = i + 1'],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('while i < 10 do')
      expect(unit.code).toContain('  i = i + 1')
      expect(unit.code).toContain('end')
    })

    it('should handle complex condition', () => {
      const node = createLoopNode('loop6', 'while', 'item', 'items[i] ~= nil')

      const { context } = createMockContext({
        renderExecFromPort: () => ['process(item)'],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('while items[i] ~= nil do')
      expect(unit.code).toContain('  process(item)')
    })
  })

  describe('each loops', () => {
    it('should generate each loop with pairs', () => {
      const node = createLoopNode('loop7', 'each', 'item', 'myList')

      const { context } = createMockContext({
        renderExecFromPort: () => ['print(item)'],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('for _, item in pairs(myList) do')
      expect(unit.code).toContain('  print(item)')
      expect(unit.code).toContain('end')
    })

    it('should sanitize iterator variable', () => {
      const node = createLoopNode('loop8', 'each', 'my-item', 'data')

      const { context } = createMockContext({
        renderExecFromPort: () => [],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('for _, my_item in pairs(data) do')
    })
  })

  describe('error handling', () => {
    it('should emit error for empty expression', () => {
      const node = createLoopNode('loop9', 'while', 'i', '')

      const { context, diagnostics } = createMockContext({
        renderExecFromPort: () => [],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toHaveLength(0)
      expect(diagnostics.hasErrors()).toBe(true)

      const errors = diagnostics.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0]?.id).toBe('loop-empty-expression')
    })

    it('should emit error for whitespace-only expression', () => {
      const node = createLoopNode('loop10', 'for', 'i', '   ')

      const { context, diagnostics } = createMockContext({
        renderExecFromPort: () => [],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toHaveLength(0)
      expect(diagnostics.hasErrors()).toBe(true)
    })
  })

  describe('default iterator variable', () => {
    it('should use "_i" as default when iterator variable is empty', () => {
      const node = createLoopNode('loop11', 'for', '', '1,5')

      const { context } = createMockContext({
        renderExecFromPort: () => [],
      })

      const unit = loopGenerator.generate(node, context)

      expect(unit.code).toContain('for _i = 1, 5 do')
    })
  })
})
