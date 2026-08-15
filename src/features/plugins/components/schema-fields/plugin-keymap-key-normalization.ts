/**
 * Canonical key normalization for plugin-keymap keys.
 *
 * Contract (v2, extended):
 * - Trim outer whitespace.
 * - Collapse internal whitespace runs to single spaces (outside angle-bracket tokens).
 * - For `<...>` tokens:
 *   - Strip internal spaces.
 *   - Split into modifier segments + terminal key segment.
 *   - Canonicalize modifier aliases (case-insensitive):
 *       Ctrl, Control → C
 *       Alt           → A
 *       Meta          → M
 *       Shift         → S
 *   - Deduplicate repeated modifiers.
 *   - Recompose in canonical order: C, M, A, S.
 *   - Canonicalize special key-name aliases (case-insensitive):
 *       Enter → CR
 *   - Special key names preserve their original casing unless an alias applies
 *       (e.g. Enter→CR). Only modifier letters are lowercased.
 * - Return normalized string unchanged otherwise.
 *
 * Canonical modifier order: C, M, A, S
 * (Control, Meta, Alt, Shift — matches common Vim convention)
 *
 * Mandatory use sites: duplicate detection, save delta application,
 * pair-link bookkeeping, and tests.
 */

// ---------------------------------------------------------------------------
// Modifier alias table (case-insensitive lookup → canonical single letter)
// ---------------------------------------------------------------------------

const MODIFIER_ALIAS_MAP: ReadonlyMap<string, string> = new Map([
  ['ctrl', 'c'],
  ['control', 'c'],
  ['c', 'c'],
  ['alt', 'a'],
  ['a', 'a'],
  ['meta', 'm'],
  ['m', 'm'],
  ['shift', 's'],
  ['s', 's'],
])

// Canonical modifier order: C, M, A, S
const CANONICAL_MODIFIER_ORDER: readonly string[] = ['c', 'm', 'a', 's']

// ---------------------------------------------------------------------------
// Special key-name alias table (case-insensitive lookup → canonical name)
// ---------------------------------------------------------------------------

const SPECIAL_KEY_ALIAS_MAP: ReadonlyMap<string, string> = new Map([
  ['enter', 'cr'],
  ['return', 'cr'],
  // Canonical form: ensure <CR>/<cr>/<cR> all normalize to lowercase 'cr'
  ['cr', 'cr'],
])

// ---------------------------------------------------------------------------
// Token normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a single `<...>` token body (the content between < and >).
 * Handles modifier canonicalization, ordering, deduplication, and special-key aliases.
 */
function normalizeTokenBody(inner: string): string {
  // Strip all spaces
  const stripped = inner.replace(/\s+/g, '')

  // Split on '-' to get segments
  const segments = stripped.split('-')

  // The last segment is the terminal key; everything before it is a potential modifier.
  // We need to distinguish modifiers from the terminal key.
  // Strategy: greedily consume leading segments that are known modifiers.
  const modifiers: string[] = []
  let terminalIndex = 0

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (seg === undefined) break
    const lower = seg.toLowerCase()
    if (MODIFIER_ALIAS_MAP.has(lower)) {
      const canonical = MODIFIER_ALIAS_MAP.get(lower)
      if (canonical !== undefined) {
        modifiers.push(canonical)
      }
      terminalIndex = i + 1
    } else {
      // Not a modifier — stop consuming modifiers
      break
    }
  }

  // Terminal key is everything from terminalIndex onward, rejoined with '-'
  const terminalParts = segments.slice(terminalIndex)
  const rawTerminal = terminalParts.join('-')
  const terminalLower = rawTerminal.toLowerCase()

  // Apply special key-name alias (e.g. Enter → cr); preserve original casing when no alias matches
  const terminal = SPECIAL_KEY_ALIAS_MAP.get(terminalLower) ?? rawTerminal

  // Deduplicate modifiers (preserve first occurrence)
  const seenModifiers = new Set<string>()
  const uniqueModifiers: string[] = []
  for (const mod of modifiers) {
    if (!seenModifiers.has(mod)) {
      seenModifiers.add(mod)
      uniqueModifiers.push(mod)
    }
  }

  // Sort modifiers into canonical order: C, M, A, S
  uniqueModifiers.sort((a, b) => {
    const ai = CANONICAL_MODIFIER_ORDER.indexOf(a)
    const bi = CANONICAL_MODIFIER_ORDER.indexOf(b)
    // Unknown modifiers sort to end (shouldn't happen given alias table)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // Recompose: modifiers + terminal
  if (uniqueModifiers.length === 0) {
    return terminal
  }
  return `${uniqueModifiers.join('-')}-${terminal}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function normalizeKeymapKey(input: string): string {
  // Trim outer whitespace
  const trimmed = input.trim()

  // Process <...> tokens with full normalization
  const result = trimmed.replace(/<[^>]*>/g, (token) => {
    const inner = token.slice(1, -1)
    const normalized = normalizeTokenBody(inner)
    return `<${normalized}>`
  })

  // Collapse remaining internal whitespace runs to single spaces
  return result.replace(/\s+/g, ' ')
}
