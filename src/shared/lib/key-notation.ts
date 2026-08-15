/**
 * Shared key notation utilities for converting browser keyboard events
 * to Vim key notation and related helpers.
 *
 * Re-exported from here so both the keymaps feature and plugin schema fields
 * can use the same utilities without cross-feature imports.
 */

/**
 * Convert a browser KeyboardEvent to Vim key notation.
 *
 * Examples:
 * - 'a' key → 'a'
 * - Ctrl+a → '<C-a>'
 * - Enter → '<CR>'
 * - Space → '<Space>'
 * - Ctrl+Shift+p → '<C-S-p>'
 */
export function keyEventToVimNotation(event: KeyboardEvent): string {
  const modifiers: string[] = []

  // Handle edge case where event.key might be empty
  const rawKey = event.key
  if (!rawKey) return ''

  if (event.ctrlKey) modifiers.push('C')
  if (event.altKey) modifiers.push('A')
  if (event.shiftKey && rawKey.length > 1) modifiers.push('S') // Only for special keys
  if (event.metaKey) modifiers.push('D') // macOS Command key

  let key: string = rawKey

  // Map special keys to Vim notation
  const specialKeyMap: Record<string, string> = {
    Enter: 'CR',
    Escape: 'Esc',
    Tab: 'Tab',
    Backspace: 'BS',
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Delete: 'Del',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    F1: 'F1',
    F2: 'F2',
    F3: 'F3',
    F4: 'F4',
    F5: 'F5',
    F6: 'F6',
    F7: 'F7',
    F8: 'F8',
    F9: 'F9',
    F10: 'F10',
    F11: 'F11',
    F12: 'F12',
  }

  const mappedKey = specialKeyMap[key]
  if (mappedKey !== undefined) {
    key = mappedKey
  } else if (key.length === 1) {
    // Single character - use as-is (uppercase for letters with shift)
    if (event.shiftKey && /[a-z]/.test(key)) {
      key = key.toUpperCase()
    }
  }

  // Build the notation
  if (modifiers.length > 0 || specialKeyMap[rawKey] !== undefined) {
    return `<${[...modifiers, key].join('-')}>`
  }

  return key
}

/**
 * Normalize a key to its Vim notation form.
 * Handles both raw keys and already-notated keys.
 *
 * Examples:
 * - ' ' → '<Space>'
 * - '<Space>' → '<Space>' (already normalized)
 * - 'Tab' → '<Tab>'
 * - '<Tab>' → '<Tab>' (already normalized)
 * - 'a' → 'a' (single char stays as-is)
 * - '\\' → '\\' (backslash stays as-is)
 */
export function normalizeToVimNotation(key: string): string {
  // Already in bracket notation
  if (key.startsWith('<') && key.endsWith('>')) {
    return key
  }

  // Map of raw key values to their Vim notation
  const keyToNotation: Record<string, string> = {
    ' ': '<Space>',
    Tab: '<Tab>',
    Enter: '<CR>',
    Escape: '<Esc>',
    Backspace: '<BS>',
    Delete: '<Del>',
    Insert: '<Insert>',
    Home: '<Home>',
    End: '<End>',
    PageUp: '<PageUp>',
    PageDown: '<PageDown>',
    ArrowUp: '<Up>',
    ArrowDown: '<Down>',
    ArrowLeft: '<Left>',
    ArrowRight: '<Right>',
  }

  const notation = keyToNotation[key]
  if (notation !== undefined) {
    return notation
  }

  // Single character keys stay as-is
  return key
}

/**
 * Apply leader key replacement to a key sequence.
 * Replaces the leader key at the start of the sequence with <leader>.
 *
 * Handles all leader key formats:
 * - Space (' ' or '<Space>')
 * - Special keys like '<Tab>', '<BS>'
 * - Single character keys like '\\', ','
 */
export function applyLeaderReplacement(
  sequence: string,
  leaderKey: string,
  autoReplace: boolean,
): string {
  if (!autoReplace || !leaderKey) return sequence

  // Normalize the leader key to its Vim notation for comparison
  const leaderNotation = normalizeToVimNotation(leaderKey)

  // Replace the leader key at the start of the sequence
  if (sequence.startsWith(leaderNotation)) {
    return `<leader>${sequence.slice(leaderNotation.length)}`
  }

  // Also check if the sequence starts with the raw leader key
  // (for single-char leaders that aren't in bracket notation)
  if (
    leaderKey.length === 1 &&
    !leaderKey.startsWith('<') &&
    sequence.startsWith(leaderKey)
  ) {
    return `<leader>${sequence.slice(leaderKey.length)}`
  }

  return sequence
}

/**
 * Get a human-readable display name for a key.
 */
export function getKeyDisplayName(key: string): string {
  if (key === ' ' || key === '<Space>') return 'Space'
  if (key === '\\') return 'Backslash'
  if (key === ',') return 'Comma'
  return key
}
