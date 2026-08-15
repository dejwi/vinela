// ============================================
// Pre-Generation Checks
// Runs all diagnostic checks before generation
// ============================================

import { PRE_GENERATION_CHECKS } from '@/features/lua-generator/diagnostics'
import type { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import type { PreGenerationContext } from '@/features/lua-generator/diagnostics/types'

/**
 * Run all pre-generation diagnostic checks.
 * Collects errors and warnings without failing fast.
 */
export function runPreGenerationChecks(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  for (const check of PRE_GENERATION_CHECKS) {
    check.run(ctx, collector)
  }
}
