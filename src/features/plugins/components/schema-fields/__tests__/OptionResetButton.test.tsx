import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OptionResetButton } from '../OptionResetButton'

describe('OptionResetButton', () => {
  it('renders icon button with aria-label', () => {
    render(
      <OptionResetButton
        optionLabel="Callback"
        scope="simple"
        onReset={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Reset "Callback" to default' }),
    ).toBeInTheDocument()
  })

  it('opens confirm dialog and handles confirm/cancel', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    render(
      <OptionResetButton
        optionLabel="Callback"
        scope="lua"
        onReset={onReset}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Reset "Callback" to default' }),
    )
    expect(
      screen.getByText(
        'Your edited value and any include-toggle override will be cleared.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onReset).toHaveBeenCalledTimes(0)

    await user.click(
      screen.getByRole('button', { name: 'Reset "Callback" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('shows object and simple scope descriptions', async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <OptionResetButton
        optionLabel="Group"
        scope="object"
        onReset={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Reset "Group" to default' }),
    )
    expect(
      screen.getByText(
        'Your edits to all sub-fields under "Group" will be cleared.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    rerender(
      <OptionResetButton
        optionLabel="Group"
        scope="simple"
        onReset={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Reset "Group" to default' }),
    )
    expect(
      screen.getByText('Your edited value will be cleared.'),
    ).toBeInTheDocument()
  })

  it('supports disabled state', () => {
    render(
      <OptionResetButton
        optionLabel="Disabled"
        scope="simple"
        disabled={true}
        onReset={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Reset "Disabled" to default' }),
    ).toBeDisabled()
  })
})
