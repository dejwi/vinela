import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _getPendingUpdateIdForTests,
  _resetUpdateServiceForTests,
  checkForAvailableUpdate,
  clearPendingUpdateResource,
  installPendingUpdate,
} from '../update-service'

const updaterMocks = vi.hoisted(() => {
  class MockUpdate {
    currentVersion = '0.1.0'
    version = '0.2.0'
    date: string | undefined = '2026-07-03'
    body: string | undefined = 'New release'
    close = vi.fn(async () => {})
    downloadAndInstall = vi.fn(async () => {})
  }

  return { check: vi.fn(), relaunch: vi.fn(async () => {}), MockUpdate }
})

vi.mock('@tauri-apps/plugin-updater', () => ({ check: updaterMocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: updaterMocks.relaunch,
}))

function setTauriAvailable(): void {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {},
  })
}

describe('update-service', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    await _resetUpdateServiceForTests()
  })

  it('returns unsupported outside Tauri', async () => {
    await expect(checkForAvailableUpdate('manual')).resolves.toEqual({
      success: true,
      outcome: 'unsupported',
    })
  })

  it('stores, installs, and clears a generic update resource', async () => {
    setTauriAvailable()
    updaterMocks.check.mockResolvedValueOnce(new updaterMocks.MockUpdate())
    const checkResult = await checkForAvailableUpdate('manual')
    if (!checkResult.success || checkResult.outcome !== 'available') {
      throw new Error('Expected available update in test setup')
    }

    expect(checkResult.update.updateId).toBe(_getPendingUpdateIdForTests())
    await expect(
      installPendingUpdate(checkResult.update.updateId, () => {}),
    ).resolves.toEqual({
      success: true,
      outcome: 'installed',
      relaunch: 'succeeded',
    })
    expect(_getPendingUpdateIdForTests()).toBeNull()

    await clearPendingUpdateResource()
    expect(_getPendingUpdateIdForTests()).toBeNull()
  })

  it('returns stale when a pending check is cleared', async () => {
    setTauriAvailable()
    let resolveCheck!: (
      value: InstanceType<typeof updaterMocks.MockUpdate>,
    ) => void
    updaterMocks.check.mockReturnValueOnce(
      new Promise<InstanceType<typeof updaterMocks.MockUpdate>>((resolve) => {
        resolveCheck = resolve
      }),
    )

    const checkPromise = checkForAvailableUpdate('manual')
    await clearPendingUpdateResource()
    resolveCheck(new updaterMocks.MockUpdate())

    await expect(checkPromise).resolves.toEqual({
      success: true,
      outcome: 'stale',
      source: 'manual',
    })
  })
})
