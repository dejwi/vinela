// ============================================
// Check 10: Disabled Graph Dependencies
// ============================================

import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'
import {
  buildGraphReferenceMap,
  collectDisabledDependencies,
  reportDisabledDependencies,
} from './disabled-dependencies-helpers'

/**
 * Check ID constant for disabled graph dependencies.
 */
export const DISABLED_DEPENDENCIES_CHECK_ID = 'check-disabled-dependencies'

/**
 * Check for enabled graphs that depend on disabled graphs.
 *
 * - Enabled graphs depending on disabled graphs → Warning
 * - Reports dependency chain: X depends on Y (disabled) → Z (disabled)
 *
 * Complexity: O(G^2) in worst case, but typically O(G) due to precomputed states
 */
export function checkDisabledDependencies(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  const references = buildGraphReferenceMap(ctx.graphs)

  for (const graph of ctx.graphs) {
    const graphState = ctx.disableStates.get(graph.id)
    if (graphState?.effective.kind !== 'enabled') {
      continue
    }

    const referencedGraphs = references.get(graph.id)
    if (!referencedGraphs || referencedGraphs.size === 0) {
      continue
    }

    const disabledDependencies = collectDisabledDependencies(
      graph,
      referencedGraphs,
      ctx,
    )
    reportDisabledDependencies(graph, disabledDependencies, collector)
  }
}
