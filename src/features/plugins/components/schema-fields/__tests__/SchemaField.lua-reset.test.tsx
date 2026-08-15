import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  PluginConfigValue,
  SchemaLuaOption,
  SchemaOption,
} from '@/shared/types'
import { SchemaField } from '../SchemaField'

function createOption(defaultValue?: string): SchemaLuaOption {
  return {
    key: 'callback',
    label: 'Callback',
    type: 'lua',
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
  }
}

describe('SchemaField lua reset affordance', () => {
  it('does not render reset icon when value matches default and no override', () => {
    const option = createOption('function() return nil end')

    render(
      <SchemaField
        option={option}
        value={'function() return nil end'}
        onChange={vi.fn()}
        allValues={{ callback: 'function() return nil end' }}
        onResetOption={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Reset "Callback" to default' }),
    ).not.toBeInTheDocument()
  })

  it('renders reset icon and confirms reset callback', async () => {
    const user = userEvent.setup()
    const onResetOption = vi.fn()
    const option = createOption('function() return nil end')
    const allValues: Record<string, PluginConfigValue> = {
      callback: 'function() return true end',
    }

    render(
      <SchemaField
        option={option as SchemaOption}
        value={'function() return true end'}
        onChange={vi.fn()}
        allValues={allValues}
        onResetOption={onResetOption}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Reset "Callback" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(onResetOption).toHaveBeenCalledTimes(1)
  })
})
