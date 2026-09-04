import { describe, expect, it } from 'vitest'
import { resolveKeymapActivation } from './profile-inclusion'

const profiles = [
  { id: 'a', name: 'A', color: '#000000', defaultActive: true },
  { id: 'b', name: 'B', color: '#000000', defaultActive: false },
]

describe('resolveKeymapActivation', () => {
  it.each([
    [{ enabled: true }, new Set<string>(), { kind: 'local', enabled: true }],
    [{ enabled: false }, new Set<string>(), { kind: 'local', enabled: false }],
    [
      { enabled: false, profileIds: ['gone'] },
      new Set<string>(),
      { kind: 'local', enabled: false },
    ],
    [
      { enabled: false, profileIds: ['a', 'b'] },
      new Set<string>(['b']),
      { kind: 'profiles', enabled: true },
    ],
    [
      { enabled: true, profileIds: ['a'] },
      new Set<string>(),
      { kind: 'profiles', enabled: false },
    ],
    [
      { enabled: true, enabledOverride: false, profileIds: ['a'] },
      new Set<string>(['a']),
      { kind: 'override', enabled: false },
    ],
    [
      { enabled: false, enabledOverride: true, profileIds: ['a'] },
      new Set<string>(),
      { kind: 'override', enabled: true },
    ],
    [
      { enabled: false, enabledOverride: true, profileIds: ['gone'] },
      new Set<string>(),
      { kind: 'local', enabled: false },
    ],
  ])('resolves %o', (keymap, activeProfileIds, expected) => {
    expect(resolveKeymapActivation(keymap, profiles, activeProfileIds)).toEqual(
      expected,
    )
  })
})
