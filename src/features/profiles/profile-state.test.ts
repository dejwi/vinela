import { describe, expect, it } from 'vitest'
import { getActiveProfileIds } from './profile-state'

const profiles = [
  { id: 'on', name: 'On', color: '#000000', defaultActive: true },
  { id: 'off', name: 'Off', color: '#000000', defaultActive: false },
]

describe('getActiveProfileIds', () => {
  it('resolves defaults with checkout overrides', () => {
    expect([
      ...getActiveProfileIds(profiles, { on: false, off: true }),
    ]).toEqual(['off'])
  })
})
