import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import type {
  PluginConfigValue,
  SchemaMappingTableOption,
} from '@/shared/types'
import { MappingTableField } from '../MappingTableField'

type RowChangeHandler = (nextValue: PluginConfigValue[]) => void

function makeOption(): SchemaMappingTableOption {
  return {
    key: 'presets',
    label: 'Presets',
    type: 'mapping-table',
    default: [],
    columns: [
      {
        key: 'filetype',
        label: 'Filetype',
        type: 'select',
        default: 'lua',
        options: [
          { value: 'lua', label: 'Lua' },
          { value: 'javascript', label: 'JavaScript' },
          { value: 'markdown', label: 'Markdown' },
          { value: 'toString', label: 'toString' },
        ],
      },
      {
        key: 'preset',
        label: 'Preset',
        type: 'select',
        default: 'black',
        autoFill: {
          kind: 'value-by-column',
          sourceColumn: 'filetype',
          fallback: 'preserve',
          values: {
            lua: 'stylua',
            javascript: 'prettierd',
          },
        },
        options: [
          { value: 'stylua', label: 'stylua' },
          { value: 'prettierd', label: 'prettierd' },
          { value: 'black', label: 'black' },
        ],
      },
    ],
    emit: {
      targetKey: 'filetype',
      keyColumn: 'filetype',
      valueColumn: 'preset',
      valueTemplate:
        'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
    },
  }
}

function makeChainedOption(): SchemaMappingTableOption {
  return {
    key: 'chain',
    label: 'Chain',
    type: 'mapping-table',
    default: [],
    columns: [
      {
        key: 'filetype',
        label: 'Filetype',
        type: 'select',
        default: 'lua',
        options: [
          { value: 'lua', label: 'Lua' },
          { value: 'javascript', label: 'JavaScript' },
        ],
      },
      {
        key: 'preset',
        label: 'Preset',
        type: 'select',
        default: 'manual-b',
        autoFill: {
          kind: 'value-by-column',
          sourceColumn: 'filetype',
          fallback: 'preserve',
          values: {
            lua: 'stylua',
            javascript: 'prettierd',
          },
        },
        options: [
          { value: 'manual-b', label: 'manual-b' },
          { value: 'stylua', label: 'stylua' },
          { value: 'prettierd', label: 'prettierd' },
        ],
      },
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'manual-style',
        autoFill: {
          kind: 'value-by-column',
          sourceColumn: 'preset',
          fallback: 'preserve',
          values: {
            'manual-b': 'manual-style',
            stylua: 'lua-style',
            prettierd: 'web-style',
          },
        },
        options: [
          { value: 'manual-style', label: 'manual-style' },
          { value: 'lua-style', label: 'lua-style' },
          { value: 'web-style', label: 'web-style' },
        ],
      },
    ],
    emit: {
      targetKey: 'filetype',
      keyColumn: 'filetype',
      valueColumn: 'preset',
      valueTemplate:
        'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
    },
  }
}

function ControlledField({
  option,
  onChangeSpy,
}: {
  option: SchemaMappingTableOption
  onChangeSpy: RowChangeHandler
}): React.JSX.Element {
  const [value, setValue] = useState<PluginConfigValue[]>([])

  return (
    <MappingTableField
      option={option}
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue)
        onChangeSpy(nextValue)
      }}
    />
  )
}

function createRowChangeTracker(): {
  readonly calls: PluginConfigValue[][]
  readonly handler: RowChangeHandler
} {
  const calls: PluginConfigValue[][] = []
  return {
    calls,
    handler: (nextValue) => {
      calls.push(nextValue)
    },
  }
}

async function selectValue(index: number, optionName: string): Promise<void> {
  const combobox = screen.getAllByRole('combobox')[index]
  if (combobox === undefined) {
    throw new Error(`Missing combobox at index ${String(index)}`)
  }

  await userEvent.click(combobox)
  await userEvent.click(screen.getByRole('option', { name: optionName }))
}

function lastRows(
  calls: readonly PluginConfigValue[][],
): PluginConfigValue[] | undefined {
  return calls[calls.length - 1]
}

describe('MappingTableField', () => {
  beforeAll(() => {
    if (typeof HTMLElement.prototype.hasPointerCapture !== 'function') {
      HTMLElement.prototype.hasPointerCapture = () => false
    }
    if (typeof HTMLElement.prototype.setPointerCapture !== 'function') {
      HTMLElement.prototype.setPointerCapture = () => {}
    }
    if (typeof HTMLElement.prototype.releasePointerCapture !== 'function') {
      HTMLElement.prototype.releasePointerCapture = () => {}
    }
  })

  it('autofills the initial row from schema defaults', async () => {
    const tracker = createRowChangeTracker()
    render(
      <ControlledField option={makeOption()} onChangeSpy={tracker.handler} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /add row/i }))

    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'lua', preset: 'stylua' },
    ])
  })

  it('autofills the preset when the source filetype changes', async () => {
    const tracker = createRowChangeTracker()
    render(
      <ControlledField option={makeOption()} onChangeSpy={tracker.handler} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /add row/i }))
    await selectValue(0, 'JavaScript')

    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'javascript', preset: 'prettierd' },
    ])
  })

  it('allows manual target edits without changing the source column', async () => {
    const tracker = createRowChangeTracker()
    render(
      <ControlledField option={makeOption()} onChangeSpy={tracker.handler} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /add row/i }))
    await selectValue(1, 'black')

    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'lua', preset: 'black' },
    ])
  })

  it('preserves the current target when the source has no mapping', async () => {
    const tracker = createRowChangeTracker()
    render(
      <ControlledField option={makeOption()} onChangeSpy={tracker.handler} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /add row/i }))
    await selectValue(1, 'black')
    await selectValue(0, 'Markdown')

    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'markdown', preset: 'black' },
    ])
  })

  it('ignores inherited autofill properties like toString', async () => {
    const tracker = createRowChangeTracker()
    render(
      <ControlledField option={makeOption()} onChangeSpy={tracker.handler} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /add row/i }))
    await selectValue(1, 'black')
    await selectValue(0, 'toString')

    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'toString', preset: 'black' },
    ])
  })

  it('documents non-cascading chained autofill semantics', async () => {
    const tracker = createRowChangeTracker()
    render(
      <ControlledField
        option={makeChainedOption()}
        onChangeSpy={tracker.handler}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /add row/i }))
    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'lua', preset: 'stylua', mode: 'manual-style' },
    ])

    await selectValue(0, 'JavaScript')
    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'javascript', preset: 'prettierd', mode: 'manual-style' },
    ])

    await selectValue(1, 'stylua')
    expect(lastRows(tracker.calls)).toEqual([
      { filetype: 'javascript', preset: 'stylua', mode: 'lua-style' },
    ])
  })
})
