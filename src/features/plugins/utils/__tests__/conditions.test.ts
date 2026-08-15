import { describe, expect, it } from 'vitest'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import {
  buildOptionIndex,
  isOptionEnabled,
  isOptionVisible,
  resolveConditionValue,
} from '../conditions'

function makeOption(
  option: Partial<SchemaOption> & Pick<SchemaOption, 'key' | 'label' | 'type'>,
): SchemaOption {
  return option as SchemaOption
}

describe('conditions utils', () => {
  it('indexes nested object properties', () => {
    const options: SchemaOption[] = [
      makeOption({
        key: 'picker',
        label: 'Picker',
        type: 'object',
        properties: [
          makeOption({
            key: 'picker.enabled',
            label: 'Enabled',
            type: 'boolean',
            default: true,
          }),
        ],
      }),
    ]
    const index = buildOptionIndex(options)
    expect(index.has('picker.enabled')).toBe(true)
  })

  it('resolves stored, default, and absent values', () => {
    const options: SchemaOption[] = [
      makeOption({
        key: 'picker.enabled',
        label: 'Enabled',
        type: 'boolean',
        default: true,
      }),
    ]
    const index = buildOptionIndex(options)
    expect(
      resolveConditionValue(
        'picker.enabled',
        { 'picker.enabled': false },
        index,
      ),
    ).toEqual({ source: 'stored', value: false })
    expect(resolveConditionValue('picker.enabled', {}, index)).toEqual({
      source: 'default',
      value: true,
    })
    expect(resolveConditionValue('missing', {}, index)).toEqual({
      source: 'absent',
    })
  })

  it('uses default-true when value absent for visibility/enabled checks', () => {
    const gate = makeOption({
      key: 'picker.enabled',
      label: 'Enabled',
      type: 'boolean',
      default: true,
    })
    const child = makeOption({
      key: 'picker.matcher.fuzzy',
      label: 'Fuzzy',
      type: 'boolean',
      visibleWhen: { key: 'picker.enabled', equals: true },
      enabledWhen: { key: 'picker.enabled', equals: true },
    })
    const index = buildOptionIndex([gate, child])
    const values: Record<string, PluginConfigValue> = {}
    expect(isOptionVisible(child, values, index)).toBe(true)
    expect(isOptionEnabled(child, values, index)).toBe(true)
  })
})
