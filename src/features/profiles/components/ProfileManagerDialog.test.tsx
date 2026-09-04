import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectProfilesStore } from '../store'
import { ProfileManagerDialog } from './ProfileManagerDialog'

const alpha = {
  id: 'a',
  name: 'Alpha',
  color: '#6366f1',
  defaultActive: true,
}

describe('ProfileManagerDialog', () => {
  const saveProfiles = vi.fn().mockResolvedValue(undefined)
  const setProfileActive = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    saveProfiles.mockClear()
    setProfileActive.mockClear()
    useProjectProfilesStore.setState({
      profiles: [alpha],
      overrides: {},
      initStatus: { status: 'ready', projectPath: '/p' },
      projectPath: '/p',
      error: null,
      saveProfiles,
      setProfileActive,
    })
  })

  it('saves colors selected from the in-app palette', async () => {
    render(
      <ProfileManagerDialog open onOpenChange={vi.fn()} projectPath="/p" />,
    )
    fireEvent.click(screen.getByLabelText('Color for Alpha'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Set Alpha color to #22c55e' }),
    )
    expect(
      document.querySelector('input[type="color"]'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Hex color for Alpha'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveProfiles).toHaveBeenCalledWith([
        { ...alpha, color: '#22c55e' },
      ]),
    )
    expect(setProfileActive).toHaveBeenCalledWith('a', true)
  })

  it('keeps current and default state drafts independent', async () => {
    render(
      <ProfileManagerDialog open onOpenChange={vi.fn()} projectPath="/p" />,
    )
    fireEvent.click(screen.getByLabelText('Use Alpha in current checkout'))
    fireEvent.click(
      screen.getByLabelText('Use Alpha by default in new checkouts'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveProfiles).toHaveBeenCalledWith([
        { ...alpha, defaultActive: false },
      ]),
    )
    expect(setProfileActive).toHaveBeenCalledWith('a', false)
  })

  it('preserves drafts when checkout overrides change while open', () => {
    render(
      <ProfileManagerDialog open onOpenChange={vi.fn()} projectPath="/p" />,
    )
    fireEvent.change(screen.getByPlaceholderText('Profile name'), {
      target: { value: 'Edited' },
    })
    useProjectProfilesStore.setState({ overrides: { a: false } })

    expect(screen.getByPlaceholderText('Profile name')).toHaveValue('Edited')
  })

  it('renders the empty copy and whitespace-name accessibility fallback', () => {
    useProjectProfilesStore.setState({
      profiles: [{ ...alpha, name: ' ' }],
    })
    const { unmount } = render(
      <ProfileManagerDialog open onOpenChange={vi.fn()} projectPath="/p" />,
    )
    expect(screen.getByLabelText('Color for profile')).toBeInTheDocument()

    unmount()
    useProjectProfilesStore.setState({ profiles: [] })
    render(
      <ProfileManagerDialog open onOpenChange={vi.fn()} projectPath="/p" />,
    )
    expect(screen.getByText('No profiles yet')).toBeInTheDocument()
  })
})
