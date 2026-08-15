// src/features/lua-generator/generators/nodes/shared/input-resolver.ts
// Input resolution utilities for node generators

import type { GenerationContext, InputResolutionResult } from '../types'

/**
 * Resolve an input value from bindings with fallback.
 * Checks connected input first, then falls back to provided default.
 */
export function resolveInput(
  context: GenerationContext,
  portId: string,
  fallback?: string,
): InputResolutionResult {
  const binding =
    context.getInputValue?.(portId) ?? context.inputBindings[portId]

  if (binding !== undefined && binding.length > 0) {
    return { kind: 'bound', expression: binding }
  }

  if (fallback !== undefined && fallback.length > 0) {
    return { kind: 'fallback', expression: fallback }
  }

  return { kind: 'missing' }
}

/**
 * Resolve input expression or return empty string if missing.
 * Use when the input is optional.
 */
export function resolveInputOptional(
  context: GenerationContext,
  portId: string,
  fallback?: string,
): string {
  const result = resolveInput(context, portId, fallback)
  return result.kind === 'missing' ? '' : result.expression
}

/**
 * Resolve required input expression, emitting diagnostic if missing.
 */
export function resolveInputRequired(
  context: GenerationContext,
  nodeId: string,
  nodeType: string,
  portId: string,
  description: string,
): string | null {
  const result = resolveInput(context, portId)

  if (result.kind === 'missing') {
    context.emitDiagnostic({
      id: 'node-missing-input',
      severity: 'error',
      category: 'connectivity',
      message: `Missing required input: ${description}`,
      details: `Port '${portId}' on ${nodeType} node '${nodeId}' has no connected input or fallback value.`,
      source: {
        graphId: context.graphId,
        nodeId,
        nodeType,
        portId,
      },
      suggestions: [
        `Connect a data source to the ${description} port`,
        `Set a fallback value in the node configuration`,
      ],
    })
    return null
  }

  return result.expression
}

/**
 * Get the condition expression for a condition node.
 * Combines hardcoded values with operator.
 */
export function buildConditionExpression(
  hardcodedA: string,
  operator: string,
  hardcodedB: string,
): string {
  const a = hardcodedA.trim()
  const b = hardcodedB.trim()

  if (a.length === 0 || b.length === 0) {
    return ''
  }

  return `${a} ${operator} ${b}`
}
