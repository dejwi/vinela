// Diagnostics utilities for node generators

import type { GenerationDiagnostic } from '@/features/lua-generator/diagnostics/types'

/**
 * Standard diagnostic codes for node generators.
 */
export const DiagnosticCodes = {
  INVALID_CONFIG: 'node-invalid-config',
  MISSING_INPUT: 'node-missing-input',
  UNSUPPORTED_LEGACY: 'node-unsupported-legacy',
  MISSING_TARGET: 'node-missing-target',
  TEMPLATE_RENDER_FAILED: 'node-template-render-failed',
  ASYNC_BRANCH_MISSING: 'node-async-branch-missing',
} as const

export type DiagnosticCode =
  (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes]

/**
 * Create a standard diagnostic for node generation issues.
 */
export function createNodeDiagnostic(
  code: DiagnosticCode,
  severity: 'error' | 'warning',
  message: string,
  graphId: string,
  nodeId: string,
  nodeType: string,
  details?: string,
  graphName?: string,
): GenerationDiagnostic {
  return {
    id: `${code}-${nodeId}`,
    severity,
    category: severity === 'error' ? 'config' : 'syntax',
    message,
    ...(details !== undefined ? { details } : {}),
    source: {
      graphId,
      ...(graphName !== undefined ? { graphName } : {}),
      nodeId,
      nodeType,
    },
    suggestions: [],
  }
}
