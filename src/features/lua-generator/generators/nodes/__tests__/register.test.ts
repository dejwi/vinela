import { describe, expect, it, vi } from 'vitest'
import type { NodeData } from '@/shared/types'
import { getGenerator, registerGenerator } from '../register'
import type { NodeGenerator } from '../types'

describe('Generator Registry', () => {
  it('returns generators for registered node types', () => {
    const requiredTypes = [
      'trigger:startup',
      'condition',
      'loop',
      'callable-entry',
      'return',
      'action:set-option',
      'action:set-keymap',
      'action:set-variable',
      'action:run-action',
      'action:create-autocmd',
      'action:set-highlight',
      'action:get-variable',
      'action:call-function',
      'code-block',
      'graph-ref',
      'run-function',
      'builtin:require-module',
      'builtin:check-feature',
      'builtin:check-platform',
      'builtin:get-variable',
      'builtin:ui.notify',
      'builtin:buffers.open-file',
      'builtin:automation.delay',
      'builtin:input.prompt',
      'plugin-action',
    ]

    for (const type of requiredTypes) {
      expect(getGenerator(type)).toBeDefined()
    }
  })

  it('returns undefined for unknown node types', () => {
    expect(getGenerator('unknownType')).toBeUndefined()
  })

  it('allows registering custom generators', () => {
    const customGenerator: NodeGenerator<NodeData> = {
      generate: vi.fn((node, context) => ({
        nodeId: node.id,
        nodeType: 'custom',
        code: [],
        localVars: [],
        inputBindings: {},
        outputBindings: {},
        indentLevel: context.indentLevel,
      })),
    }

    registerGenerator('custom', customGenerator)
    expect(getGenerator('custom')).toBe(customGenerator)
  })
})
