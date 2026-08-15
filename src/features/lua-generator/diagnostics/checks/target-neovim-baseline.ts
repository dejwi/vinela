// ============================================
// Target Neovim Baseline Pre-Generation Check
// ============================================

import {
  getTargetNeovimCallout,
  TARGET_NEOVIM_BASELINE_DIAGNOSTIC_ID,
} from '@/features/lua-generator/lib/target-neovim'
import type { DiagnosticsCollector } from '../collector'
import type { PreGenerationContext } from '../types'

export function checkTargetNeovimBaseline(
  ctx: PreGenerationContext,
  collector: DiagnosticsCollector,
): void {
  const callout = getTargetNeovimCallout(ctx.targetNeovim)
  if (callout === null) {
    return
  }

  collector.addWarning({
    id: TARGET_NEOVIM_BASELINE_DIAGNOSTIC_ID,
    category: 'runtime',
    message: callout.title,
    details: callout.message,
    suggestions:
      callout.kind === 'old-version'
        ? [
            'Upgrade Neovim to 0.12.0 or newer before deploying generated configuration.',
            'If deploying to another machine, verify that target separately.',
          ]
        : [
            'Open Settings → Neovim Status to verify your local installation.',
            'If deploying elsewhere, confirm the target runtime supports Neovim 0.12+ APIs.',
          ],
  })
}
