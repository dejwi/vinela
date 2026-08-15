// ============================================
// Lua Block Balance Checker
// Phase 8 post-generation validation utility
// ============================================

import { stripLuaLongBracketLiterals } from '@/features/lua-generator/lua-utils'

export interface BlockBalanceResult {
  /** True when openers and closers are equal */
  balanced: boolean
  /** Count of block-opening tokens */
  openers: number
  /** Count of block-closing tokens */
  closers: number
}

/**
 * Lightweight Lua block-balance checker.
 *
 * Counts block-structure keywords that each require a matching closer:
 * - Openers: `function`, `if`, `for`, `while`, `repeat`, standalone `do`
 * - Closers: `end`, `until`
 *
 * Design note on `do` handling:
 * In `for ... do` and `while ... do`, `do` is part of the loop header and is
 * NOT a separate opener — the entire loop is closed by a single `end`. A
 * blanket inclusion of every `do` token would double-count these loops.
 *
 * The approach taken here correctly handles BOTH single-line and multi-line
 * loop headers:
 *
 *   Single-line:  `for k, v in pairs(t) do`  → `for` = opener, `do` = ignored
 *   Multi-line:   `for _, x in ipairs({      → `for` = opener
 *                   "a",                      (continuation)
 *                 }) do`                      → `do` consumed by pending `for`
 *   Standalone:   `do`  / `  do`             → standalone `do` = opener
 *
 * The algorithm uses a `pendingLoopDo` counter:
 * - Each `for` or `while` increments `pendingLoopDo` (expecting a `do`).
 * - The first `do` seen while `pendingLoopDo > 0` decrements it (consumed).
 * - A `do` seen when `pendingLoopDo == 0` is a genuine standalone opener.
 *
 * Operates purely on token counts — it is not a full parser — but is
 * sufficient to catch structural mistakes introduced by generators (e.g. a
 * node that emits a `function` or `if` without a matching `end`).
 *
 * Other caveats / known limitations:
 * - String literals are stripped BEFORE comment stripping to avoid treating
 *   `--` inside a string (e.g. `print('a--b')`) as a comment start.
 * - Single-quoted and double-quoted string literals are replaced with empty
 *   placeholders (`""` / `''`) to avoid counting tokens inside string values
 *   (e.g. `"if"` or `'end'`).
 * - Line comments are stripped after string replacement, so only genuine `--`
 *   markers remain at that point.
 * - All matching long-bracket strings and comments are excluded.
 * - `repeat…until` contributes 1 opener (`repeat`) and 1 closer (`until`),
 *   which is correct because `until` ends the repeat block.
 * - `function` used as an expression (e.g. `local f = function() end`) still
 *   contributes 1 opener and 1 closer, which is correct.
 * - `else` / `elseif` do not open or close a block — they are transparent
 *   to this check.
 */
export function checkLuaBlockBalance(lua: string): BlockBalanceResult {
  // Strip single-quoted and double-quoted string literals FIRST to avoid
  // treating `--` inside a string as a comment start (e.g. `print('a--b')`
  // must not truncate the line before `end`).
  // The regex handles escaped quotes via `\\.` matching any escaped character.
  const withoutStrings = stripLuaLongBracketLiterals(lua)
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")

  // Now strip line comments.  By this point any `--` that appeared inside a
  // string literal has been replaced by the placeholder (`""` / `''`), so
  // `--` that remains is a genuine comment marker.
  const strippedLines = withoutStrings.split('\n').map((line) => {
    const commentIdx = line.indexOf('--')
    return commentIdx === -1 ? line : line.slice(0, commentIdx)
  })

  const withoutLineComments = strippedLines.join('\n')

  // Count openers and closers by scanning all keyword tokens in document order.
  // This handles multi-line loop headers (e.g. `for ... ipairs({\n...\n}) do`)
  // where the loop-header `do` appears on a different line from `for`/`while`.
  let openers = 0
  let closers = 0

  // Tracks how many `for`/`while` keywords are awaiting their `do`.
  // When > 0, the next `do` is a loop-header token (not a standalone opener).
  let pendingLoopDo = 0

  // Scan all keyword tokens in source order.
  const tokenPattern =
    /\b(function|if|for|while|repeat|do|end|until|else|elseif)\b/g
  for (
    let match = tokenPattern.exec(withoutLineComments);
    match !== null;
    match = tokenPattern.exec(withoutLineComments)
  ) {
    const token = match[1]
    switch (token) {
      case 'function':
      case 'if':
      case 'repeat':
        openers += 1
        break
      case 'for':
      case 'while':
        openers += 1
        pendingLoopDo += 1 // expect a matching `do` in the header
        break
      case 'do':
        if (pendingLoopDo > 0) {
          // This `do` closes the pending loop header — not an extra opener.
          pendingLoopDo -= 1
        } else {
          // Genuine standalone `do ... end` block.
          openers += 1
        }
        break
      case 'end':
      case 'until':
        closers += 1
        break
      // `else` / `elseif` are transparent — they neither open nor close.
      default:
        break
    }
  }

  return {
    balanced: openers === closers,
    openers,
    closers,
  }
}
