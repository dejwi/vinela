// ============================================
// Check 11: Code Block Validation
// ============================================

import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'
import { validateCodeBlockNode } from './code-block-node-validation'

/**
 * Check ID constant for code block validation.
 */
export const CODE_BLOCK_VALIDATION_CHECK_ID = 'check-code-blocks'

/**
 * Validate code block nodes.
 *
 * Rules from contract:
 * 1. Empty code (code.trim().length === 0) → Error
 * 2. Duplicate port names (case-insensitive across inputs+outputs) → Error
 * 3. Reserved word port names → Warning
 * 4. Mismatched block keywords → Warning
 * 5. Missing return statement when outputs exist → Warning
 *
 * Complexity: O(C * L) where C = code blocks, L = lines of code per block
 */
export function checkCodeBlocks(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const graph of ctx.graphs) {
    const disableState = ctx.disableStates.get(graph.id)
    if (disableState?.effective.kind !== 'enabled') {
      continue
    }

    for (const node of graph.nodes) {
      validateCodeBlockNode(graph, node, collector)
    }
  }
}
