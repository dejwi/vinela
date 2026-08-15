import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetUpdateStoreForTests, useUpdateStore } from '../store'
import type { UpdateCheckResult } from '../types'

const serviceMocks = vi.hoisted(() => ({
  checkForAvailableUpdate:
    vi.fn<(source: 'startup' | 'manual') => Promise<UpdateCheckResult>>(),
  installPendingUpdate: vi.fn(),
  clearPendingUpdateResource: vi.fn(async () => {}),
}))

vi.mock('../update-service', () => serviceMocks)

describe('update store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetUpdateStoreForTests()
  })

  it('deduplicates concurrent checks', async () => {
    let resolveCheck!: (value: UpdateCheckResult) => void
    serviceMocks.checkForAvailableUpdate.mockReturnValue(
      new Promise<UpdateCheckResult>((resolve) => {
        resolveCheck = resolve
      }),
    )

    const first = useUpdateStore.getState().checkForUpdates('manual')
    const second = useUpdateStore.getState().checkForUpdates('startup')
    expect(serviceMocks.checkForAvailableUpdate).toHaveBeenCalledTimes(1)
    resolveCheck({ success: true, outcome: 'none' })
    await expect(Promise.all([first, second])).resolves.toEqual([
      { success: true, outcome: 'none' },
      { success: true, outcome: 'none' },
    ])
  })

  it('retains a cached available update', async () => {
    const update = {
      updateId: 'update-1',
      version: '0.2.0',
      currentVersion: '0.1.0',
    }
    serviceMocks.checkForAvailableUpdate.mockResolvedValue({
      success: true,
      outcome: 'available',
      update,
    })

    await useUpdateStore.getState().checkForUpdates('manual')
    await expect(
      useUpdateStore.getState().checkForUpdates('manual'),
    ).resolves.toEqual({
      success: true,
      outcome: 'available',
      update,
    })
    expect(serviceMocks.checkForAvailableUpdate).toHaveBeenCalledTimes(1)
  })
})
