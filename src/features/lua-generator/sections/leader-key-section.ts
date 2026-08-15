/**
 * Leader Key Section Generator
 *
 * Generates vim.g.mapleader and vim.g.maplocalleader assignments.
 * Must be emitted BEFORE any vim.keymap.set() calls.
 */

import type { LeaderKeySectionInput, SectionResult } from '../types'

/**
 * Generate the leader key section.
 *
 * Neovim resolves <leader> at keymap-registration time, not at keypress time.
 * This section must come before any keymap definitions.
 *
 * @param input - Leader key configuration
 * @returns SectionResult with generated code
 */
export function generateLeaderKeySection(
  input: LeaderKeySectionInput,
): SectionResult {
  const { leaderKey } = input

  // If leaderKey is undefined, empty, or backslash (default), don't emit anything
  // Neovim uses \ as default leader; we don't emit if user hasn't configured one
  if (!leaderKey || leaderKey === '\\') {
    return {
      id: 'leader-key',
      code: [],
      diagnostics: [],
    }
  }

  const code: string[] = []

  // Add comment header
  code.push('-- Leader key (must be set before any keymaps)')

  // Escape the leader key for Lua string
  const escapedLeader = escapeForLuaString(leaderKey)
  code.push(`vim.g.mapleader = "${escapedLeader}"`)
  code.push(`vim.g.maplocalleader = "${escapedLeader}"`)

  return {
    id: 'leader-key',
    code,
    diagnostics: [],
  }
}

/**
 * Escape a string for use in Lua double-quoted string.
 */
function escapeForLuaString(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Backslash first
    .replace(/"/g, '\\"') // Double quotes
    .replace(/\n/g, '\\n') // Newlines
    .replace(/\r/g, '\\r') // Carriage returns
}
