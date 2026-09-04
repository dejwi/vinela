import { describe, expect, it } from 'vitest'
import type { KeymapMode } from '@/shared/types'
import type { KeymapEntry, ManualKeymapEntry } from '../../types'
import {
  detectKeymapConflicts,
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

function detectConflicts(entries: KeymapEntry[]) {
  return detectKeymapConflicts(entries, [], new Set(), true)
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

  it('uses profile activation and overrides', () => {
    const profiles = [
      { id: 'a', name: 'A', color: '#000000', defaultActive: false },
    ]
    const active = new Set(['a'])
    const activeProfiled = makeProjectEntry('n', ['n'], false)
    activeProfiled.keymap.profileIds = ['a']
    expect(
      detectKeymapConflicts(
        [makeProjectEntry('n'), activeProfiled],
        profiles,
        active,
        true,
      ),
    ).toHaveLength(1)
    activeProfiled.keymap.enabled = true
    expect(
      detectKeymapConflicts(
        [makeProjectEntry('n'), activeProfiled],
        profiles,
        new Set(),
        true,
      ),
    ).toEqual([])
    activeProfiled.keymap.enabledOverride = true
    expect(
      detectKeymapConflicts(
        [makeProjectEntry('n'), activeProfiled],
        profiles,
        new Set(),
        true,
      ),
    ).toHaveLength(1)
    activeProfiled.keymap.enabledOverride = false
    expect(
      detectKeymapConflicts(
        [makeProjectEntry('n'), activeProfiled],
        profiles,
        active,
        true,
      ),
    ).toEqual([])
  })

  it('returns no conflicts until profiles are ready', () => {
    expect(
      detectKeymapConflicts(
        [makeProjectEntry('n'), makeProjectEntry('n')],
        [],
        new Set(),
        false,
      ),
    ).toEqual([])
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
