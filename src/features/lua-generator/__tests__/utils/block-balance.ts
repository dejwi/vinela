/**
 * Block Balance Assertion Utility
 *
 * Fast structural sanity check for generated Lua that can run in every
 * integration test, even where `luac` is unavailable.
 *
 * Delegates to the production `checkLuaBlockBalance` from
 * `orchestrator/lua-block-balance` for consistency and zero duplication.
 */

import { checkLuaBlockBalance } from '@/features/lua-generator/orchestrator/lua-block-balance'

// ============================================
// Public Types
// ============================================

export interface BlockBalanceAssertOptions {
  /**
   * Optional label included in the error message for context.
   * e.g. "startup graph 'My Config'" for easier failure triage.
   */
  context?: string
  /**
   * Number of Lua source lines to prepend to the error message as a
   * preview for debugging. Defaults to 0 (no preview). Negative values
   * are normalised to 0.
   */
  includePreviewLines?: number
}

// ============================================
// Public API
// ============================================

/**
 * Assert that all Lua block openers (`function`, `if`, `for`, `while`,
 * `repeat`, standalone `do`) have matching closers (`end`, `until`).
 *
 * Uses the same lightweight token-counting algorithm as the Phase 8
 * post-generation validator, so this test-side check stays in sync with
 * what the orchestrator validates in production.
 *
 * Known limitations (inherited from `checkLuaBlockBalance`):
 * - Semantically invalid but token-balanced Lua still passes.
 * - Wrong nesting order (e.g. interleaved blocks) is not guaranteed to be
 *   detected; the checker only compares total counts.
 *
 * @throws Error with opener/closer counts, optional context, and optional
 *   preview lines when blocks are unbalanced.
 */
export function assertBlocksBalanced(
  lua: string,
  options?: BlockBalanceAssertOptions,
): void {
  const context = options?.context
  const previewLines = Math.max(0, options?.includePreviewLines ?? 0)

  const result = checkLuaBlockBalance(lua)
  if (result.balanced) return

  const net = result.openers - result.closers
  const direction = net > 0 ? 'unclosed blocks' : 'extra closers'

  let message = 'Lua blocks are unbalanced'
  if (context !== undefined) {
    message += ` [${context}]`
  }
  message += `: ${result.openers} opener(s) vs ${result.closers} closer(s)`
  message += ` (net ${net > 0 ? '+' : ''}${net} — ${direction})`

  if (previewLines > 0) {
    const lines = lua.split('\n').slice(0, previewLines)
    message += `\n\nLua preview (first ${previewLines} lines):\n${lines.join('\n')}`
  }

  throw new Error(message)
}
