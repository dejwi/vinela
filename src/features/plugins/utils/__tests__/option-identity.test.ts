import { describe, expect, it } from 'vitest'
import type {
  PluginConfigValue,
  SchemaLuaOption,
  SchemaObjectOption,
  SchemaOption,
} from '@/shared/types'
import {
  identityToOverrideKey,
  type OptionIdentity,
  readIdentityValue,
  writeIdentityValue,
} from '../option-identity'

function createLuaOption(key: string): SchemaLuaOption {
  return {
    key,
    label: key,
    type: 'lua',
  }
}

function createObjectOption(
  key: string,
  properties: SchemaOption[] = [],
): SchemaObjectOption {
  return {
    key,
    label: key,
    type: 'object',
    properties,
  }
}

describe('option-identity helpers', () => {
  it('builds override keys for top-level, nested, and literal dot keys', () => {
    const topLevel: OptionIdentity = {
      option: createLuaOption('handler'),
      ancestors: [],
    }
    expect(identityToOverrideKey(topLevel)).toBe('handler')

    const parent = createObjectOption('opts')
    const child: OptionIdentity = {
      option: createLuaOption('callback'),
      ancestors: [parent],
    }
    expect(identityToOverrideKey(child)).toBe('opts.callback')

    const grandParent = createObjectOption('a')
    const parentNested = createObjectOption('b')
    const deep: OptionIdentity = {
      option: createLuaOption('c'),
      ancestors: [grandParent, parentNested],
    }
    expect(identityToOverrideKey(deep)).toBe('a.b.c')

    const dottedTopLevel: OptionIdentity = {
      option: createLuaOption('session_lens.picker'),
      ancestors: [],
    }
    expect(identityToOverrideKey(dottedTopLevel)).toBe('session_lens.picker')
  })

  it('reads top-level and nested values', () => {
    const parent = createObjectOption('opts')
    const values: Record<string, PluginConfigValue> = {
      handler: 'return true',
      opts: {
        callback: 'return false',
      },
    }

    expect(
      readIdentityValue(
        { option: createLuaOption('handler'), ancestors: [] },
        values,
      ),
    ).toBe('return true')

    expect(
      readIdentityValue(
        {
          option: createLuaOption('callback'),
          ancestors: [parent],
        },
        values,
      ),
    ).toBe('return false')

    expect(
      readIdentityValue(
        {
          option: createLuaOption('missing'),
          ancestors: [parent],
        },
        values,
      ),
    ).toBeUndefined()
  })

  it('writes and deletes top-level values', () => {
    const values: Record<string, PluginConfigValue> = {
      handler: 'a',
    }

    const written = writeIdentityValue(
      { option: createLuaOption('handler'), ancestors: [] },
      values,
      'b',
    )
    expect(written['handler']).toBe('b')
    expect(values['handler']).toBe('a')

    const deleted = writeIdentityValue(
      { option: createLuaOption('handler'), ancestors: [] },
      values,
      undefined,
    )
    expect(deleted['handler']).toBeUndefined()
  })

  it('writes nested values by cloning spine and supports delete', () => {
    const root = createObjectOption('opts')
    const childObject = createObjectOption('inner')
    const values: Record<string, PluginConfigValue> = {
      opts: {
        inner: {
          other: 'keep',
        },
      },
      unrelated: 'x',
    }

    const next = writeIdentityValue(
      {
        option: createLuaOption('callback'),
        ancestors: [root, childObject],
      },
      values,
      'return true',
    )

    expect(
      (next['opts'] as Record<string, PluginConfigValue>)['inner'],
    ).toEqual({
      other: 'keep',
      callback: 'return true',
    })
    expect(next['opts']).not.toBe(values['opts'])
    expect(values).toEqual({
      opts: {
        inner: {
          other: 'keep',
        },
      },
      unrelated: 'x',
    })

    const deleted = writeIdentityValue(
      {
        option: createLuaOption('callback'),
        ancestors: [root, childObject],
      },
      next,
      undefined,
    )
    expect(
      (deleted['opts'] as Record<string, PluginConfigValue>)['inner'],
    ).toEqual({
      other: 'keep',
    })
  })

  it('creates missing object levels for nested writes', () => {
    const root = createObjectOption('opts')
    const childObject = createObjectOption('inner')
    const next = writeIdentityValue(
      {
        option: createLuaOption('callback'),
        ancestors: [root, childObject],
      },
      {},
      'return true',
    )

    expect(next).toEqual({
      opts: {
        inner: {
          callback: 'return true',
        },
      },
    })
  })
})
