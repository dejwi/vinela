// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FunctionParamDefaultsForm } from './FunctionParamDefaultsForm'
import {
  getDefaultInputMode,
  parseParamDefaultAsText,
} from './param-default-helpers'
import type { FunctionParamInfo } from './types'

// ============================================
// Helper unit tests (no DOM)
// ============================================

describe('getDefaultInputMode', () => {
  it('returns text for any/string/number/boolean with no saved value', () => {
    expect(getDefaultInputMode('any', undefined)).toBe('text')
    expect(getDefaultInputMode('string', undefined)).toBe('text')
    expect(getDefaultInputMode('number', undefined)).toBe('text')
    expect(getDefaultInputMode('boolean', undefined)).toBe('text')
  })

  it('returns lua for table/buffer/window with no saved value', () => {
    expect(getDefaultInputMode('table', undefined)).toBe('lua')
    expect(getDefaultInputMode('buffer', undefined)).toBe('lua')
    expect(getDefaultInputMode('window', undefined)).toBe('lua')
  })

  it('derives mode from existing scalar value → text', () => {
    expect(getDefaultInputMode('any', { kind: 'scalar', value: 'hello' })).toBe(
      'text',
    )
    expect(getDefaultInputMode('number', { kind: 'scalar', value: 42 })).toBe(
      'text',
    )
  })

  it('derives mode from existing lua value → lua', () => {
    expect(
      getDefaultInputMode('any', { kind: 'lua', lua: 'vim.fn.getcwd()' }),
    ).toBe('lua')
    expect(getDefaultInputMode('table', { kind: 'lua', lua: '{}' })).toBe('lua')
  })
})

describe('parseParamDefaultAsText', () => {
  it('returns null for empty / whitespace input', () => {
    expect(parseParamDefaultAsText('any', '')).toBeNull()
    expect(parseParamDefaultAsText('any', '   ')).toBeNull()
  })

  it('stores any-typed text as scalar string', () => {
    expect(parseParamDefaultAsText('any', 'my-project')).toEqual({
      kind: 'scalar',
      value: 'my-project',
    })
  })

  it('parses valid number as scalar number', () => {
    expect(parseParamDefaultAsText('number', '42')).toEqual({
      kind: 'scalar',
      value: 42,
    })
    expect(parseParamDefaultAsText('number', '3.14')).toEqual({
      kind: 'scalar',
      value: 3.14,
    })
  })

  it('falls back to scalar string for invalid number in text mode', () => {
    expect(parseParamDefaultAsText('number', 'hello')).toEqual({
      kind: 'scalar',
      value: 'hello',
    })
  })

  it('parses true/false as scalar boolean', () => {
    expect(parseParamDefaultAsText('boolean', 'true')).toEqual({
      kind: 'scalar',
      value: true,
    })
    expect(parseParamDefaultAsText('boolean', 'FALSE')).toEqual({
      kind: 'scalar',
      value: false,
    })
  })

  it('falls back to scalar string for non-boolean in text mode', () => {
    expect(parseParamDefaultAsText('boolean', 'maybe')).toEqual({
      kind: 'scalar',
      value: 'maybe',
    })
  })

  it('stores table/buffer/window as scalar string in text mode', () => {
    expect(parseParamDefaultAsText('table', '{}')).toEqual({
      kind: 'scalar',
      value: '{}',
    })
  })
})

// ============================================
// FunctionParamDefaultsForm integration tests
// ============================================

describe('FunctionParamDefaultsForm', () => {
  it('syncs raw Lua input when current default changes (AllowedValues path)', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      {
        name: 'mode',
        type: 'string',
        optional: false,
        allowedValues: ['normal', 'insert'],
      },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="plugin:test:old"
        params={params}
        paramDefaults={{ mode: { kind: 'lua', lua: 'vim.g.mode_old' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(screen.getByPlaceholderText('Lua expression')).toHaveValue(
      'vim.g.mode_old',
    )

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="plugin:test:old"
        params={params}
        paramDefaults={{ mode: { kind: 'lua', lua: 'vim.g.mode_new' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(screen.getByPlaceholderText('Lua expression')).toHaveValue(
      'vim.g.mode_new',
    )
  })

  it('resets row-local mode when switching to another function snapshot', () => {
    const onParamDefaultsChange = vi.fn()

    const paramsA: readonly FunctionParamInfo[] = [
      {
        name: 'target',
        type: 'string',
        optional: false,
        allowedValues: ['one', 'two'],
      },
    ]

    const paramsB: readonly FunctionParamInfo[] = [
      {
        name: 'target',
        type: 'string',
        optional: false,
        allowedValues: ['alpha', 'beta'],
      },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="plugin:test:first"
        params={paramsA}
        paramDefaults={{ target: { kind: 'lua', lua: 'vim.g.dynamic_target' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(screen.getByPlaceholderText('Lua expression')).toBeInTheDocument()

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="plugin:test:second"
        params={paramsB}
        paramDefaults={{ target: { kind: 'scalar', value: 'alpha' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(
      screen.queryByPlaceholderText('Lua expression'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('alpha')
  })

  it('shows Text mode by default for any-typed param with no saved value', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'prompt', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // Text mode placeholder
    expect(screen.getByPlaceholderText('Text value')).toBeInTheDocument()
    // Advanced toggle is present
    expect(
      screen.getByRole('button', { name: 'Show advanced parameters' }),
    ).toBeInTheDocument()
  })

  it('shows Lua mode for any-typed param with existing lua default', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'expr', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ expr: { kind: 'lua', lua: 'vim.fn.expand("~")' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // Lua mode placeholder
    expect(screen.getByPlaceholderText('Lua expression')).toBeInTheDocument()
    // Input should have the lua value
    expect(screen.getByPlaceholderText('Lua expression')).toHaveValue(
      'vim.fn.expand("~")',
    )
  })

  it('does not show toggle for string-typed param', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'name', type: 'string', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // String type always text mode, no toggle button
    expect(screen.getByPlaceholderText('Text value')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /Text mode|Lua mode|Switch number input to Lua expression/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('stores value as scalar when typing in text mode for any-typed param', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'defaultText', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const input = screen.getByPlaceholderText('Text value')
    fireEvent.change(input, { target: { value: 'my-project' } })

    const calls = onParamDefaultsChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall).toBeDefined()
    expect(lastCall?.[0]).toEqual({
      defaultText: { kind: 'scalar', value: 'my-project' },
    })
  })

  it('toggles to Lua mode and stores value as lua kind', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'expr', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // Type something in text mode first
    const input = screen.getByPlaceholderText('Text value')
    fireEvent.change(input, { target: { value: 'hello' } })

    // Click the toggle button to switch to Lua mode
    const toggleBtn = screen.getByRole('button', {
      name: 'Switch input to Lua expression mode',
    })
    fireEvent.click(toggleBtn)

    // After toggle, the stored value should be lua kind
    const calls = onParamDefaultsChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toEqual({
      expr: { kind: 'lua', lua: 'hello' },
    })
  })

  it('shows preview line when input is non-empty in text mode', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'val', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // No preview when empty
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()

    // Simulate typing
    const input = screen.getByPlaceholderText('Text value')
    fireEvent.change(input, { target: { value: 'test' } })

    // Preview should show quoted value in text mode
    expect(screen.getByText('→ "test"')).toBeInTheDocument()
  })

  it('shows unquoted preview in Lua mode', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'expr', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ expr: { kind: 'lua', lua: 'vim.fn.getcwd()' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // In Lua mode, preview shows raw expression (no quotes)
    expect(screen.getByText('→ vim.fn.getcwd()')).toBeInTheDocument()
  })

  it('shows "Value from connection" disabled state with no toggle', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'buf', type: 'any', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
        connectedParams={{ buf: true }}
      />,
    )

    expect(screen.getByText('Value from connection')).toBeInTheDocument()
    // No per-param text/lua toggle button when connected
    expect(
      screen.queryByRole('button', {
        name: /Text mode|Lua mode|Switch number input to Lua expression/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('number param renders N mode indicator in text mode', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'timeout', type: 'number', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    // Number input should be present
    expect(screen.getByPlaceholderText('Number')).toBeInTheDocument()

    // Toggle button should be present with aria-label for accessibility
    const toggleBtn = screen.getByRole('button', {
      name: 'Switch number input to Lua expression',
    })
    expect(toggleBtn).toBeInTheDocument()

    // Verify the N glyph is rendered (as a span with mono font styling)
    expect(toggleBtn.querySelector('span')).toHaveTextContent('N')
  })

  it('number param stores valid number as scalar number type', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'timeout', type: 'number', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const input = screen.getByPlaceholderText('Number')
    fireEvent.change(input, { target: { value: '150' } })

    const calls = onParamDefaultsChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toEqual({
      timeout: { kind: 'scalar', value: 150 },
    })
    expect(typeof lastCall?.[0].timeout.value).toBe('number')
  })

  it('number param shows validation hint for invalid number', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'timeout', type: 'number', optional: false },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const input = screen.getByPlaceholderText('Number')
    fireEvent.change(input, { target: { value: 'not-a-number' } })

    // Should show validation warning
    expect(screen.getByText('⚠ Not a valid number')).toBeInTheDocument()
  })

  it('hides advanced params by default and reveals them via toggle', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'cwd', type: 'string', optional: true, tier: 'basic' },
      {
        name: 'layout.preset',
        type: 'string',
        optional: true,
        tier: 'advanced',
      },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(screen.getByText('cwd')).toBeInTheDocument()
    expect(screen.queryByText('layout.preset')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Show advanced parameters' }),
    )
    expect(screen.getByText('layout.preset')).toBeInTheDocument()
  })

  it('promotes advanced param to visible when it has a stored value', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      {
        name: 'layout.preset',
        type: 'string',
        optional: true,
        tier: 'advanced',
      },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ 'layout.preset': { kind: 'scalar', value: 'ivy' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(screen.getByText('layout.preset')).toBeInTheDocument()
  })

  it('boolean select shows clear only when value exists and clears to deleted key', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'untracked', type: 'boolean', optional: true },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    expect(
      screen.queryByText('Clear (use function default)'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /true/i }))

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ untracked: { kind: 'scalar', value: true } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(
      screen.getByRole('option', { name: 'Clear (use function default)' }),
    )

    const calls = onParamDefaultsChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toEqual({})
    expect(lastCall?.[0]).not.toEqual({
      untracked: { kind: 'scalar', value: '__vinela_clear_default__' },
    })
  })

  it('updates boolean tooltip copy and exposes aria-label on mode toggle', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'untracked', type: 'boolean', optional: true },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const toggleButton = screen.getByRole('button', {
      name: 'Switch boolean input to Lua expression',
    })
    vi.useFakeTimers()
    fireEvent.focus(toggleButton)
    vi.advanceTimersByTime(800)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent(
      'Pick true or false from the list. Click to switch to a Lua expression instead.',
    )
    expect(tooltip).not.toHaveTextContent(/Text mode/i)
    vi.useRealTimers()
  })

  it('keeps raw-Lua sentinel behavior for allowed-values select', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      {
        name: 'mode',
        type: 'string',
        optional: false,
        allowedValues: ['normal', 'insert'],
      },
    ]

    render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ mode: { kind: 'scalar', value: 'normal' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Raw Lua expression...'))

    expect(screen.getByPlaceholderText('Lua expression')).toBeInTheDocument()
    const calls = onParamDefaultsChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toEqual({})
  })

  it('boolean flow select -> clear -> switch to Lua opens empty input', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      { name: 'untracked', type: 'boolean', optional: true },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /true/i }))

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ untracked: { kind: 'scalar', value: true } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(
      screen.getByRole('option', { name: 'Clear (use function default)' }),
    )

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Switch boolean input to Lua expression',
      }),
    )
    expect(screen.getByPlaceholderText('Lua expression')).toHaveValue('')
  })

  it('allowed-values select shows clear only when value exists and clears without entering Lua mode', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      {
        name: 'preset',
        type: 'string',
        optional: true,
        allowedValues: ['normal', 'insert'],
      },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    expect(
      screen.queryByText('Clear (use function default)'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'normal' }))

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:test"
        params={params}
        paramDefaults={{ preset: { kind: 'scalar', value: 'normal' } }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(
      screen.getByRole('option', { name: 'Clear (use function default)' }),
    )

    const calls = onParamDefaultsChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toEqual({})
    expect(
      screen.queryByPlaceholderText('Lua expression'),
    ).not.toBeInTheDocument()
  })

  it('initializes group expansion once when the same key transitions from empty to populated params', () => {
    const onParamDefaultsChange = vi.fn()
    const key = 'fn:empty-to-populated'
    const params: readonly FunctionParamInfo[] = [
      { name: 'cwd', type: 'string', optional: true, group: 'General' },
      {
        name: 'withValue',
        type: 'string',
        optional: true,
        group: 'HasValue',
      },
      {
        name: 'noValue',
        type: 'string',
        optional: true,
        group: 'NoValue',
      },
    ]

    const { rerender, container } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={[]}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    expect(container.firstChild).toBeNull()

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={params}
        paramDefaults={{
          withValue: { kind: 'scalar', value: 'preset' },
        }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const triggers = screen.getAllByRole('button', {
      name: /General|HasValue|NoValue/,
    })
    const generalTrigger = triggers.find((node) =>
      node.textContent?.includes('General'),
    )
    const hasValueTrigger = triggers.find((node) =>
      node.textContent?.includes('HasValue'),
    )
    const noValueTrigger = triggers.find((node) =>
      node.textContent?.includes('NoValue'),
    )

    expect(generalTrigger?.querySelector('.-rotate-90')).toBeNull()
    expect(hasValueTrigger?.querySelector('.-rotate-90')).toBeNull()
    expect(noValueTrigger?.querySelector('.-rotate-90')).not.toBeNull()
    expect(screen.getByText('cwd')).toBeInTheDocument()
    expect(screen.getByText('withValue')).toBeInTheDocument()
    expect(screen.queryByText('noValue')).not.toBeInTheDocument()
  })

  it('retains manual group toggles across rerenders under the same key', () => {
    const onParamDefaultsChange = vi.fn()
    const key = 'fn:manual-toggle'
    const params: readonly FunctionParamInfo[] = [
      { name: 'cwd', type: 'string', optional: true, group: 'General' },
      {
        name: 'layout',
        type: 'string',
        optional: true,
        group: 'Layout',
      },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const layoutTrigger = screen
      .getAllByRole('button', { name: /Layout/ })
      .find((node) => node.textContent?.includes('Layout'))
    expect(layoutTrigger).toBeDefined()
    if (layoutTrigger !== undefined) {
      fireEvent.click(layoutTrigger)
      expect(layoutTrigger.querySelector('.-rotate-90')).toBeNull()
    }

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={params}
        paramDefaults={{ cwd: { kind: 'scalar', value: '/tmp' } }}
        connectedParams={{ layout: true }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const layoutTriggerAfter = screen
      .getAllByRole('button', { name: /Layout/ })
      .find((node) => node.textContent?.includes('Layout'))
    expect(layoutTriggerAfter?.querySelector('.-rotate-90')).toBeNull()
  })

  it('does not reinitialize group state on populated-empty-populated under the same key', () => {
    const onParamDefaultsChange = vi.fn()
    const key = 'fn:cycle'
    const params: readonly FunctionParamInfo[] = [
      { name: 'cwd', type: 'string', optional: true, group: 'General' },
      {
        name: 'layout',
        type: 'string',
        optional: true,
        group: 'Layout',
      },
    ]

    const { rerender, container } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const layoutTrigger = screen
      .getAllByRole('button', { name: /Layout/ })
      .find((node) => node.textContent?.includes('Layout'))
    if (layoutTrigger !== undefined) {
      fireEvent.click(layoutTrigger)
    }

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={[]}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )
    expect(container.firstChild).toBeNull()

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey={key}
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const layoutTriggerAfter = screen
      .getAllByRole('button', { name: /Layout/ })
      .find((node) => node.textContent?.includes('Layout'))
    expect(layoutTriggerAfter?.querySelector('.-rotate-90')).toBeNull()
  })

  it('recomputes initial open groups when selectedFunctionKey changes', () => {
    const onParamDefaultsChange = vi.fn()
    const params: readonly FunctionParamInfo[] = [
      {
        name: 'alpha',
        type: 'string',
        optional: true,
        group: 'Named',
      },
    ]

    const { rerender } = render(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:first"
        params={params}
        paramDefaults={{}}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const firstTrigger = screen
      .getAllByRole('button', { name: /Named/ })
      .find((node) => node.textContent?.includes('Named'))
    expect(firstTrigger?.querySelector('.-rotate-90')).not.toBeNull()

    rerender(
      <FunctionParamDefaultsForm
        selectedFunctionKey="fn:second"
        params={params}
        paramDefaults={{
          alpha: { kind: 'scalar', value: 'seeded' },
        }}
        onParamDefaultsChange={onParamDefaultsChange}
      />,
    )

    const secondTrigger = screen
      .getAllByRole('button', { name: /Named/ })
      .find((node) => node.textContent?.includes('Named'))
    expect(secondTrigger?.querySelector('.-rotate-90')).toBeNull()
  })
})
