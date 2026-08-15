import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetUpdateStoreForTests } from '../../store'
import { UpdateManager } from '../UpdateManager'

const serviceMocks = vi.hoisted(() => ({
  checkForAvailableUpdate: vi.fn(),
  installPendingUpdate: vi.fn(),
  clearPendingUpdateResource: vi.fn(async () => {}),
}))
const eventMocks = vi.hoisted(() => ({ listen: vi.fn() }))
const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('../../update-service', () => serviceMocks)
vi.mock('@tauri-apps/api/event', () => eventMocks)
vi.mock('sonner', () => ({ toast: toastMocks }))

describe('UpdateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    _resetUpdateStoreForTests()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    eventMocks.listen.mockResolvedValue(() => {})
    serviceMocks.checkForAvailableUpdate.mockResolvedValue({
      success: true,
      outcome: 'none',
    })
  })

  it('starts a delayed startup check and handles a manual check', async () => {
    render(<UpdateManager />)
    await act(async () => {
      vi.advanceTimersByTime(4_000)
      await Promise.resolve()
    })
    expect(serviceMocks.checkForAvailableUpdate).toHaveBeenCalledTimes(1)

    const listener = eventMocks.listen.mock.calls[0]?.[1] as
      | (() => void)
      | undefined
    if (listener === undefined) throw new Error('Expected update menu listener')
    await act(async () => {
      listener()
      await Promise.resolve()
    })
    expect(toastMocks.loading).toHaveBeenCalledWith('Checking for updates…', {
      id: 'updates-manual-check',
    })
  })
})
