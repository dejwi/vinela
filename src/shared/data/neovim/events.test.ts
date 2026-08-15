import { describe, expect, it } from 'vitest'
import {
  canonicalizeAutocmdEventName,
  isValidAutocmdEventName,
  KNOWN_AUTOCMD_EVENT_NAMES,
  NEOVIM_EVENT_CATALOG,
  normalizeAutocmdEventNames,
  normalizeNeovimEventName,
} from '@/shared/data/neovim'
import {
  createDefaultActionConfig,
  normalizeCreateAutocmdEvents,
} from '@/shared/types'

describe('NEOVIM_EVENT_CATALOG', () => {
  it('includes BufEnter in catalog', () => {
    expect(
      NEOVIM_EVENT_CATALOG.some((event) => event.name === 'BufEnter'),
    ).toBe(true)
  })

  it('normalizes bufenter casing', () => {
    expect(normalizeNeovimEventName('bufenter')).toBe('BufEnter')
  })

  it('canonicalizes known autocmd events from case-insensitive input', () => {
    expect(canonicalizeAutocmdEventName('bufenter')).toBe('BufEnter')
    expect(canonicalizeAutocmdEventName(' DIRCHANGED ')).toBe('DirChanged')
  })

  it('keeps canonical User* behavior (uppercase User prefix only)', () => {
    expect(canonicalizeAutocmdEventName('UserMyEvent')).toBe('UserMyEvent')
    expect(canonicalizeAutocmdEventName('userMyEvent')).toBeNull()
    expect(canonicalizeAutocmdEventName('user')).toBeNull()
  })

  it('validates all known autocmd events', () => {
    for (const eventName of KNOWN_AUTOCMD_EVENT_NAMES) {
      expect(isValidAutocmdEventName(eventName)).toBe(true)
      if (eventName !== 'User') {
        expect(isValidAutocmdEventName(eventName.toLowerCase())).toBe(true)
      }
    }
  })

  it('normalizes autocmd events with canonicalization and dedupe', () => {
    expect(
      normalizeAutocmdEventNames([
        'bufenter',
        'BufEnter',
        '  DirChanged ',
        'UserMyEvent',
        'userMyEvent',
        'NotReal',
      ]),
    ).toEqual(['BufEnter', 'DirChanged', 'UserMyEvent'])
  })

  it('accepts documented Progress/PackChanged events across canonicalization', () => {
    expect(KNOWN_AUTOCMD_EVENT_NAMES).toEqual(
      expect.arrayContaining(['Progress', 'PackChanged', 'PackChangedPre']),
    )

    expect(
      normalizeAutocmdEventNames([
        ' progress ',
        'packchanged',
        'PACKCHANGEDPRE',
      ]),
    ).toEqual(['Progress', 'PackChanged', 'PackChangedPre'])
  })

  it('keeps catalog events valid in create-autocmd normalization', () => {
    for (const event of NEOVIM_EVENT_CATALOG) {
      expect(normalizeCreateAutocmdEvents([event.name])).toEqual([event.name])
    }
  })

  it('keeps shared and graph autocmd normalizers in parity', () => {
    const input = ['bufenter', 'BUFENTER', 'UserMyEvent', 'UnknownEvent']
    expect(normalizeCreateAutocmdEvents(input)).toEqual(
      normalizeAutocmdEventNames(input),
    )
  })

  it('includes all create-autocmd default events in catalog', () => {
    const defaultConfig = createDefaultActionConfig('create-autocmd')
    const catalogNames = new Set(
      NEOVIM_EVENT_CATALOG.map((event) => event.name),
    )

    for (const eventName of defaultConfig.events) {
      expect(catalogNames.has(eventName)).toBe(true)
    }
  })
})
