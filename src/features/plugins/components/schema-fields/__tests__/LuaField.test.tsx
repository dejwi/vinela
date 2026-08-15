import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LuaInclusionDecision } from '@/features/plugins/utils/lua-field-include'
import type { SchemaLuaOption } from '@/shared/types'
import { LuaField } from '../LuaField'

function createOption(overrides?: Partial<SchemaLuaOption>): SchemaLuaOption {
  return {
    key: 'callback',
    label: 'Callback',
    type: 'lua',
    default: 'function() return nil end',
    ...overrides,
  }
}

function createDecision(
  overrides?: Partial<LuaInclusionDecision>,
): LuaInclusionDecision {
  return {
    included: false,
    reason: 'matches-default',
    overrideContradiction: false,
    ...overrides,
  }
}

describe('LuaField', () => {
  it('renders include switch and checked state from decision', () => {
    render(
      <LuaField
        option={createOption()}
        value={undefined}
        onChange={vi.fn()}
        decision={createDecision({ included: true })}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('switch', {
        name: 'Include "Callback" in generated Lua',
      }),
    ).toHaveAttribute('data-state', 'checked')
  })

  it('calls onLuaIncludeChange when toggled', async () => {
    const user = userEvent.setup()
    const onLuaIncludeChange = vi.fn()

    render(
      <LuaField
        option={createOption()}
        value={undefined}
        onChange={vi.fn()}
        decision={createDecision({ included: false })}
        onLuaIncludeChange={onLuaIncludeChange}
      />,
    )

    await user.click(
      screen.getByRole('switch', {
        name: 'Include "Callback" in generated Lua',
      }),
    )

    expect(onLuaIncludeChange).toHaveBeenCalledWith(true)
  })

  it('uses inputPlaceholder before default before fallback', () => {
    const { inputPlaceholder: _placeholder, ...withoutPlaceholder } =
      createOption({ inputPlaceholder: '-- placeholder' })
    const { default: _default, ...withoutDefault } = withoutPlaceholder

    const { rerender } = render(
      <LuaField
        option={createOption({ inputPlaceholder: '-- placeholder' })}
        value={undefined}
        onChange={vi.fn()}
        decision={createDecision()}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      '-- placeholder',
    )

    rerender(
      <LuaField
        option={withoutPlaceholder}
        value={undefined}
        onChange={vi.fn()}
        decision={createDecision()}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'function() return nil end',
    )

    rerender(
      <LuaField
        option={withoutDefault}
        value={undefined}
        onChange={vi.fn()}
        decision={createDecision({ reason: 'undefined-value' })}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      '-- Lua code here',
    )
  })

  it('shows user-cleared contradiction hint with highest priority', () => {
    render(
      <LuaField
        option={createOption()}
        value={''}
        onChange={vi.fn()}
        decision={createDecision({
          included: false,
          reason: 'user-cleared',
          overrideContradiction: true,
        })}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        'Field is empty — will be omitted regardless of include toggle.',
      ),
    ).toBeInTheDocument()
  })

  it('shows explicit-override undefined hint for nil emission case', () => {
    const { default: _default, ...optionWithoutDefault } = createOption()

    render(
      <LuaField
        option={optionWithoutDefault}
        value={undefined}
        onChange={vi.fn()}
        decision={createDecision({
          included: true,
          reason: 'explicit-override',
          overrideContradiction: true,
        })}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText('No value or default — will emit nil.'),
    ).toBeInTheDocument()
  })

  it('shows template hint when value equals default and no higher-priority hint', () => {
    const option = createOption()
    render(
      <LuaField
        option={option}
        value={option.default}
        onChange={vi.fn()}
        decision={createDecision({
          included: false,
          reason: 'matches-default',
          overrideContradiction: false,
        })}
        onLuaIncludeChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Showing template default — edit to customize.'),
    ).toBeInTheDocument()
  })
})
