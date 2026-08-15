import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { InstalledPlugin, PluginSchema } from '@/shared/types'
import { InstallVersionControl } from '../InstallVersionControl'

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'blink-cmp',
    pluginName: 'blink.cmp',
    pluginRepo: 'https://github.com/saghen/blink.cmp',
    version: '1.0.0',
    options: [],
    functions: [],
    pack: {
      version: { mode: 'semver-range', value: '1.*' },
    },
    ...overrides,
  }
}

function makeInstalled(overrides?: Partial<InstalledPlugin>): InstalledPlugin {
  return {
    schemaId: 'blink-cmp',
    enabled: true,
    config: {},
    addedAt: 1,
    ...overrides,
  }
}

describe('InstallVersionControl', () => {
  it('shows the schema default effective target', () => {
    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        discardTrigger={0}
      />,
    )

    expect(
      screen.getByTestId('install-version-effective-text'),
    ).toHaveTextContent('Default: semver range 1.*')
  })

  it('saves a custom semver range override', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled()}
        onSave={onSave}
        onClear={vi.fn()}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-custom'))
    await user.type(screen.getByTestId('install-version-value-input'), ' 2.* ')
    await user.click(screen.getByTestId('install-version-save-button'))

    expect(onSave).toHaveBeenCalledWith({
      version: { mode: 'semver-range', value: '2.*' },
    })
  })

  it.each([
    ['branch', 'main', { mode: 'ref', refKind: 'branch', value: 'main' }],
    ['tag', 'v1.7.0', { mode: 'ref', refKind: 'tag', value: 'v1.7.0' }],
    ['commit', 'abc1234', { mode: 'ref', refKind: 'commit', value: 'abc1234' }],
    ['ref', 'nightly', { mode: 'ref', refKind: 'ref', value: 'nightly' }],
  ] as const)('saves %s install overrides', async (mode, value, expectedVersion) => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled()}
        onSave={onSave}
        onClear={vi.fn()}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-custom'))
    await user.selectOptions(
      screen.getByTestId('install-version-kind-select'),
      mode,
    )
    await user.type(screen.getByTestId('install-version-value-input'), value)
    await user.click(screen.getByTestId('install-version-save-button'))

    expect(onSave).toHaveBeenCalledWith({ version: expectedVersion })
  })

  it('shows validation errors for invalid values', async () => {
    const user = userEvent.setup()
    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-custom'))
    const input = screen.getByTestId('install-version-value-input')
    fireEvent.change(input, { target: { value: '   ' } })

    expect(
      screen.getByTestId('install-version-validation-message'),
    ).toHaveTextContent(
      'Install version must be a non-empty single-line string.',
    )

    await user.selectOptions(
      screen.getByTestId('install-version-kind-select'),
      'commit',
    )
    fireEvent.change(input, { target: { value: 'not-a-sha' } })

    expect(
      screen.getByTestId('install-version-validation-message'),
    ).toHaveTextContent('Commit refs must be 7-40 hexadecimal characters.')

    expect(screen.getByTestId('install-version-save-button')).toBeDisabled()
  })

  it('resets to default and discards unsaved draft changes', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockResolvedValue(undefined)

    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled({
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v1.0.0' },
          },
        })}
        onSave={vi.fn()}
        onClear={onClear}
        discardTrigger={0}
      />,
    )

    expect(
      screen.getByTestId('install-version-effective-text'),
    ).toHaveTextContent('Custom: tag v1.0.0')

    await user.type(screen.getByTestId('install-version-value-input'), '-draft')
    await user.click(screen.getByTestId('install-version-discard-button'))
    expect(screen.getByDisplayValue('v1.0.0')).toBeInTheDocument()

    await user.click(screen.getByTestId('install-version-reset-button'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('saves a dirty default draft by clearing the persisted override', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClear = vi.fn().mockResolvedValue(undefined)

    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled({
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v1.0.0' },
          },
        })}
        onSave={onSave}
        onClear={onClear}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-default'))

    expect(screen.getByTestId('install-version-save-button')).toBeEnabled()

    await user.click(screen.getByTestId('install-version-save-button'))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('resets an unsaved custom draft without clearing when nothing is persisted', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockResolvedValue(undefined)

    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled()}
        onSave={vi.fn()}
        onClear={onClear}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-custom'))
    await user.type(screen.getByTestId('install-version-value-input'), '2.*')

    expect(screen.getByTestId('install-version-reset-button')).toBeEnabled()

    await user.click(screen.getByTestId('install-version-reset-button'))

    expect(onClear).not.toHaveBeenCalled()
    expect(
      screen.queryByTestId('install-version-value-input'),
    ).not.toBeInTheDocument()
  })

  it('shows the generic compatibility warning when custom is selected', async () => {
    const user = userEvent.setup()

    render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-custom'))

    expect(
      screen.getByText(
        /Changing a plugin version can make the selected schema\/config incompatible\./,
      ),
    ).toBeInTheDocument()
  })

  it('resets unsaved draft when discardTrigger increments with unchanged installed', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const installed = makeInstalled()

    const { rerender } = render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={installed}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onDirtyChange={onDirtyChange}
        discardTrigger={0}
      />,
    )

    await user.click(screen.getByTestId('install-version-mode-custom'))
    await user.type(screen.getByTestId('install-version-value-input'), '2.*')

    rerender(
      <InstallVersionControl
        schema={makeSchema()}
        installed={installed}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onDirtyChange={onDirtyChange}
        discardTrigger={1}
      />,
    )

    expect(
      screen.queryByTestId('install-version-value-input'),
    ).not.toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenCalledWith(false)
  })

  it('resets draft baseline when installed override changes', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()

    const { rerender } = render(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled({
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v1.0.0' },
          },
        })}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onDirtyChange={onDirtyChange}
        discardTrigger={0}
      />,
    )

    await user.type(screen.getByTestId('install-version-value-input'), '-draft')

    rerender(
      <InstallVersionControl
        schema={makeSchema()}
        installed={makeInstalled({
          installOverride: {
            version: { mode: 'ref', refKind: 'tag', value: 'v2.0.0' },
          },
        })}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onDirtyChange={onDirtyChange}
        discardTrigger={0}
      />,
    )

    expect(screen.getByDisplayValue('v2.0.0')).toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenCalledWith(false)
  })
})
