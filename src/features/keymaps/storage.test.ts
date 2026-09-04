import { describe, expect, it } from 'vitest'
// Import internal helpers (exported for testing)
import {
  normalizeKeymapsFile,
  normalizeManualAction,
  normalizeRunFunctionSignature,
} from './storage'

describe('profile ID normalization', () => {
  it('normalizes malformed profiles, removes duplicates, and retains unknown IDs', () => {
    const action = { actionType: 'code-block', code: 'print(1)' }
    const base = { id: 'keymap', modes: ['n'], keySequence: 'x', action }
    expect(
      normalizeKeymapsFile({
        keymaps: [
          base,
          {
            ...base,
            id: 'two',
            profileIds: ['known', '', 'unknown', 'known', 1],
          },
        ],
      }).keymaps.map((keymap) => keymap.profileIds),
    ).toEqual([[], ['known', 'unknown']])
  })

  it('preserves boolean enabled overrides and omits malformed values', () => {
    const action = { actionType: 'code-block', code: 'print(1)' }
    const base = { modes: ['n'], keySequence: 'x', action }
    const keymaps = normalizeKeymapsFile({
      keymaps: [
        { ...base, id: 'true', enabledOverride: true },
        { ...base, id: 'false', enabledOverride: false },
        { ...base, id: 'missing' },
        { ...base, id: 'malformed', enabledOverride: 'false' },
      ],
    }).keymaps
    expect(keymaps.map((keymap) => keymap.enabledOverride)).toEqual([
      true,
      false,
      undefined,
      undefined,
    ])
  })
})

describe('normalizeManualAction', () => {
  // ── run-action round-trip ──────────────────────────────

  describe('run-action', () => {
    it('deserializes nested config correctly', () => {
      const raw = {
        actionType: 'run-action',
        config: {
          mode: 'catalog',
          actionType: 'command',
          action: ':w',
          selectedActionKey: 'write',
          paramValues: { fmt: 'json' },
        },
      }

      const result = normalizeManualAction(raw)

      expect(result).toEqual({
        actionType: 'run-action',
        config: {
          mode: 'catalog',
          actionType: 'command',
          action: ':w',
          selectedActionKey: 'write',
          paramValues: { fmt: 'json' },
        },
      })
    })

    it('falls back to defaults when config is missing', () => {
      const raw = { actionType: 'run-action' }

      const result = normalizeManualAction(raw)

      expect(result).toEqual({
        actionType: 'run-action',
        config: {
          mode: 'custom-command',
          actionType: 'command',
          action: '',
          selectedActionKey: '',
          paramValues: {},
        },
      })
    })

    it('handles config with keys actionType', () => {
      const raw = {
        actionType: 'run-action',
        config: {
          mode: 'custom-keys',
          actionType: 'keys',
          action: 'gg',
          selectedActionKey: '',
          paramValues: {},
        },
      }

      const result = normalizeManualAction(raw)

      expect(result).not.toBeNull()
      expect(result?.actionType).toBe('run-action')
      if (result?.actionType === 'run-action') {
        expect(result.config.mode).toBe('custom-keys')
        expect(result.config.actionType).toBe('keys')
        expect(result.config.action).toBe('gg')
      }
    })
  })

  // ── run-function ───────────────────────────────────────

  describe('run-function', () => {
    it('deserializes with full signature', () => {
      const raw = {
        actionType: 'run-function',
        selectedFunctionKey: 'core:vim.fn.expand',
        functionSource: { type: 'core', functionName: 'vim.fn.expand' },
        signature: {
          params: [
            {
              name: 'expr',
              type: 'string',
              tier: 'advanced',
              group: 'Layout',
              allowedValues: ['a', 'b'],
              allowedValueDescriptions: { a: 'A', b: 'B' },
              multi: false,
              objectShape: [{ name: 'width', type: 'number' }],
            },
          ],
          returns: 'string',
          luaCall: 'vim.fn.expand($params)',
        },
        paramDefaults: {
          expr: { kind: 'scalar', value: '%' },
          tags: { kind: 'multiselect', values: ['a', 'b'] },
          layout: {
            kind: 'object',
            entries: {
              preset: { kind: 'scalar', value: 'vertical' },
            },
          },
        },
      }

      const result = normalizeManualAction(raw)

      expect(result).not.toBeNull()
      expect(result?.actionType).toBe('run-function')
      if (result?.actionType === 'run-function') {
        expect(result.signature).not.toBeNull()
        expect(result.signature?.params).toHaveLength(1)
        expect(result.signature?.params[0]?.type).toBe('string')
        expect(result.signature?.params[0]?.tier).toBe('advanced')
        expect(result.signature?.params[0]?.group).toBe('Layout')
        expect(result.signature?.params[0]?.allowedValues).toEqual(['a', 'b'])
        expect(result.signature?.params[0]?.allowedValueDescriptions).toEqual({
          a: 'A',
          b: 'B',
        })
        expect(result.signature?.params[0]?.multi).toBe(false)
        expect(result.signature?.params[0]?.objectShape).toEqual([
          { name: 'width', type: 'number' },
        ])
        expect(result.signature?.returns).toBe('string')
        expect(result.paramDefaults['expr']).toEqual({
          kind: 'scalar',
          value: '%',
        })
        expect(result.paramDefaults['tags']).toEqual({
          kind: 'multiselect',
          values: ['a', 'b'],
        })
        expect(result.paramDefaults['layout']).toEqual({
          kind: 'object',
          entries: {
            preset: { kind: 'scalar', value: 'vertical' },
          },
        })
      }
    })

    it('returns null for invalid action type', () => {
      const raw = { actionType: 'nonexistent-type' }
      const result = normalizeManualAction(raw)
      expect(result).toBeNull()
    })
  })
})

describe('normalizeRunFunctionSignature', () => {
  it('falls back to any for invalid param type', () => {
    const raw = {
      params: [{ name: 'x', type: 'INVALID_TYPE' }],
      returns: 'string',
      luaCall: 'test($params)',
    }

    const result = normalizeRunFunctionSignature(raw)

    expect(result).not.toBeNull()
    expect(result?.params[0]?.type).toBe('any')
  })

  it('falls back to void for invalid returns type', () => {
    const raw = {
      params: [],
      returns: 'INVALID_TYPE',
      luaCall: 'test()',
    }

    const result = normalizeRunFunctionSignature(raw)

    expect(result).not.toBeNull()
    expect(result?.returns).toBe('void')
  })

  it('accepts valid PortDataType values', () => {
    const raw = {
      params: [
        { name: 'buf', type: 'buffer' },
        { name: 'win', type: 'window' },
      ],
      returns: 'table',
      luaCall: 'test($params)',
    }

    const result = normalizeRunFunctionSignature(raw)

    expect(result).not.toBeNull()
    expect(result?.params[0]?.type).toBe('buffer')
    expect(result?.params[1]?.type).toBe('window')
    expect(result?.returns).toBe('table')
  })

  it('returns null for non-record input', () => {
    expect(normalizeRunFunctionSignature(null)).toBeNull()
    expect(normalizeRunFunctionSignature('string')).toBeNull()
    expect(normalizeRunFunctionSignature(42)).toBeNull()
  })

  it('returns null when luaCall is missing', () => {
    const raw = {
      params: [],
      returns: 'void',
    }
    expect(normalizeRunFunctionSignature(raw)).toBeNull()
  })

  it('filters out params with empty names', () => {
    const raw = {
      params: [
        { name: '', type: 'string' },
        { name: 'valid', type: 'number' },
      ],
      returns: 'void',
      luaCall: 'test($params)',
    }

    const result = normalizeRunFunctionSignature(raw)

    expect(result).not.toBeNull()
    expect(result?.params).toHaveLength(1)
    expect(result?.params[0]?.name).toBe('valid')
  })
})
