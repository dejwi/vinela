import { describe, expect, it } from 'vitest'
import {
  normalizeProjectProfileOverrides,
  normalizeProjectProfilesFile,
} from './storage'

describe('profile storage normalization', () => {
  it('normalizes profiles and boolean overrides', () => {
    expect(
      normalizeProjectProfilesFile({
        profiles: [
          { id: ' a ', name: ' Alpha ', color: '#22C55E' },
          { id: 'a', name: 'Duplicate', color: '#000000' },
        ],
      }),
    ).toEqual({
      version: 1,
      profiles: [
        { id: 'a', name: 'Alpha', color: '#22c55e', defaultActive: true },
      ],
    })
    expect(
      normalizeProjectProfileOverrides({ overrides: { a: false, b: 'true' } }),
    ).toEqual({ a: false })
  })
})
