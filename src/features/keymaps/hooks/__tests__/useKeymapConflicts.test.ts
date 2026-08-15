import { describe, expect, it } from 'vitest'
import type { KeymapMode } from '@/shared/types'
import type { KeymapEntry, ManualKeymapEntry } from '../../types'
import {
  findConflictForEntry,
  normalizeKeyForConflict,
} from '../useKeymapConflicts'

// ── Factory Helpers ──────────────────────────────────────────────────

let nextId = 1

function makeProjectEntry(
  key: string,
  modes: KeymapMode[] = ['n'],
  enabled = true,
): ManualKeymapEntry {
  const id = `keymap-${nextId++}`
  return {
    source: 'project',
    keymapId: id,
    keymap: {
      id,
      modes,
      keySequence: key,
      description: `Test keymap ${id}`,
      action: { actionType: 'code-block', code: 'print("test")' },
      silent: true,
      noremap: true,
      expr: false,
      enabled,
    },
  }
}

// ── Replicate conflict detection without React hook ──────────────────

function detectConflicts(
  entries: KeymapEntry[],
): { mode: KeymapMode; keySequence: string; entries: KeymapEntry[] }[] {
  const conflictMap = new Map<string, KeymapEntry[]>()

  for (const entry of entries) {
    if (entry.source === 'project' && !entry.keymap.enabled) continue

    const rawKey =
      entry.source === 'graph' ? entry.keySequence : entry.keymap.keySequence
    const normalizedKey = normalizeKeyForConflict(rawKey)
    if (normalizedKey.length === 0) continue

    const modes = entry.source === 'graph' ? entry.modes : entry.keymap.modes
    for (const mode of modes) {
      const mapKey = `${mode}:${normalizedKey}`
      const existing = conflictMap.get(mapKey)
      if (existing !== undefined) {
        existing.push(entry)
      } else {
        conflictMap.set(mapKey, [entry])
      }
    }
  }

  const conflicts: {
    mode: KeymapMode
    keySequence: string
    entries: KeymapEntry[]
  }[] = []
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

// ── Tests ────────────────────────────────────────────────────────────

describe('normalizeKeyForConflict', () => {
  it('preserves case of bare characters (n ≠ N)', () => {
    expect(normalizeKeyForConflict('n')).toBe('n')
    expect(normalizeKeyForConflict('N')).toBe('N')
    expect(normalizeKeyForConflict('n')).not.toBe(normalizeKeyForConflict('N'))
  })

  it('lowercases contents inside angle brackets', () => {
    expect(normalizeKeyForConflict('<Leader>ff')).toBe('<leader>ff')
    expect(normalizeKeyForConflict('<C-A>')).toBe('<c-a>')
    expect(normalizeKeyForConflict('<CR>')).toBe('<cr>')
  })

  it('preserves case of bare chars after a bracketed prefix', () => {
    expect(normalizeKeyForConflict('<Leader>fF')).toBe('<leader>fF')
  })
})

describe('conflict detection', () => {
  it('does NOT flag n and N as conflicting (the bug)', () => {
    const conflicts = detectConflicts([
      makeProjectEntry('n', ['n']),
      makeProjectEntry('N', ['n']),
    ])
    expect(conflicts).toHaveLength(0)
  })

  it('flags <Leader>ff and <leader>ff as conflicting (same key)', () => {
    const conflicts = detectConflicts([
      makeProjectEntry('<Leader>ff', ['n']),
      makeProjectEntry('<leader>ff', ['n']),
    ])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.entries).toHaveLength(2)
  })

  it('flags two identical bare-char keymaps as conflicting', () => {
    const conflicts = detectConflicts([
      makeProjectEntry('n', ['n']),
      makeProjectEntry('n', ['n']),
    ])
    expect(conflicts).toHaveLength(1)
  })

  it('excludes disabled project keymaps from conflict detection', () => {
    const conflicts = detectConflicts([
      makeProjectEntry('n', ['n'], true),
      makeProjectEntry('n', ['n'], false),
    ])
    expect(conflicts).toHaveLength(0)
  })
})

describe('findConflictForEntry', () => {
  it('returns the conflict containing the entry, null for non-participants', () => {
    const entry1 = makeProjectEntry('n', ['n'])
    const entry2 = makeProjectEntry('n', ['n'])
    const unrelated = makeProjectEntry('x', ['n'])
    const conflicts = [
      { mode: 'n' as KeymapMode, keySequence: 'n', entries: [entry1, entry2] },
    ]
    expect(findConflictForEntry(conflicts, entry1)).toBe(conflicts[0])
    expect(findConflictForEntry(conflicts, unrelated)).toBeNull()
  })
})
