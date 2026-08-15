import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResetOptionConfirm } from '../ResetOptionConfirm'

describe('ResetOptionConfirm', () => {
  it('renders when open is true and hides when open is false', () => {
    const { rerender } = render(
      <ResetOptionConfirm
        open={true}
        optionLabel="Callback"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('Reset')).toBeInTheDocument()

    rerender(
      <ResetOptionConfirm
        open={false}
        optionLabel="Callback"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByText('Reset')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <ResetOptionConfirm
        open={true}
        optionLabel="Callback"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ResetOptionConfirm
        open={true}
        optionLabel="Callback"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders custom description when provided', () => {
    render(
      <ResetOptionConfirm
        open={true}
        optionLabel="Callback"
        description="Custom reset copy"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('Custom reset copy')).toBeInTheDocument()
  })
})
