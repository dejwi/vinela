import { useMemo } from 'react'
import type { KeymapMode } from '@/shared/types'
import type { KeymapConflict, KeymapEntry } from '../types'
import { getEntryKeySequence, getEntryModes } from '../utils'

/**
 * Normalize a key sequence for conflict comparison.
 *
 * In Neovim, bare characters are case-sensitive ('n' ≠ 'N'),
 * but special key names inside angle brackets are case-insensitive
 * ('<Leader>' = '<leader>', '<C-a>' = '<C-A>', '<CR>' = '<Cr>').
 *
 * This function lowercases only the bracketed portions while
 * preserving the case of bare characters.
 */
export function normalizeKeyForConflict(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length === 0) return trimmed

  // Replace each <...> token with its lowercased form
  return trimmed.replace(/<[^>]+>/g, (match) => match.toLowerCase())
}

/**
 * Check if an entry should participate in conflict detection.
 * Disabled manual keymaps are excluded.
 */
function isActiveEntry(entry: KeymapEntry): boolean {
  if (entry.source === 'project' && !entry.keymap.enabled) {
    return false
  }
  return true
}

/**
 * Register a single mode+key combination in the conflict map.
 */
function registerModeKey(
  conflictMap: Map<string, KeymapEntry[]>,
  mode: KeymapMode,
  normalizedKey: string,
  entry: KeymapEntry,
): void {
  const key = `${mode}:${normalizedKey}`
  const existing = conflictMap.get(key)
  if (existing !== undefined) {
    existing.push(entry)
  } else {
    conflictMap.set(key, [entry])
  }
}

/**
 * Build a conflict map from all active entries.
 */
function buildConflictMap(entries: KeymapEntry[]): Map<string, KeymapEntry[]> {
  const conflictMap = new Map<string, KeymapEntry[]>()

  for (const entry of entries) {
    if (!isActiveEntry(entry)) continue

    const normalizedKey = normalizeKeyForConflict(getEntryKeySequence(entry))
    if (normalizedKey.length === 0) continue

    for (const mode of getEntryModes(entry)) {
      registerModeKey(conflictMap, mode, normalizedKey, entry)
    }
  }

  return conflictMap
}

/**
 * Extract conflicts from a conflict map (entries with 2+ registrations).
 */
function extractConflicts(
  conflictMap: Map<string, KeymapEntry[]>,
): KeymapConflict[] {
  const conflicts: KeymapConflict[] = []

  for (const [key, conflictEntries] of conflictMap) {
    if (conflictEntries.length > 1) {
      const colonIndex = key.indexOf(':')
      conflicts.push({
        mode: key.substring(0, colonIndex) as KeymapMode,
        keySequence: key.substring(colonIndex + 1),
        entries: conflictEntries,
      })
    }
  }

  return conflicts
}

/**
 * Detect conflicting keymaps (same mode + key sequence).
 * Returns an array of conflicts, where each conflict contains
 * the conflicting entries.
 *
 * Only enabled manual keymaps participate in conflict detection.
 * Graph-sourced keymaps always participate.
 */
export function useKeymapConflicts(entries: KeymapEntry[]): KeymapConflict[] {
  return useMemo(() => {
    const conflictMap = buildConflictMap(entries)
    return extractConflicts(conflictMap)
  }, [entries])
}

/**
 * Check if a specific entry is involved in any conflict.
 * Returns the conflict if found, null otherwise.
 */
export function findConflictForEntry(
  conflicts: KeymapConflict[],
  entry: KeymapEntry,
): KeymapConflict | null {
  for (const conflict of conflicts) {
    if (conflict.entries.includes(entry)) {
      return conflict
    }
  }
  return null
}
