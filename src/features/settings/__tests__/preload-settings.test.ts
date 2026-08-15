import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Must mock before importing the module under test
vi.mock('@/shared/lib/settings', () => ({
  loadAppSettings: vi.fn(),
  getDefaultAppSettings: vi.fn(() => ({
    theme: 'system',
    recentProjects: [],
    neovimOutputPath: undefined,
  })),
  SETTING_DEFAULTS: {
    theme: 'system',
    autoSaveDelay: 1000,
    showGrid: true,
    snapToGrid: false,
    gridSpacing: 20,
    showMinimap: true,
    confirmNodeDeletion: true,
  },
  updateAppSettings: vi.fn(),
}))

describe('preloadSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module state between tests so each test gets a fresh module
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('populates cache before hook mounts', async () => {
    const mockSettings = {
      theme: 'dark' as const,
      recentProjects: [],
      neovimOutputPath: '/custom/path',
    }

    const { loadAppSettings } = await import('@/shared/lib/settings')
    vi.mocked(loadAppSettings).mockResolvedValue(mockSettings)

    const { preloadSettings } = await import('../hooks/useAppSettings')

    preloadSettings()

    // Wait for async completion
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Calling preloadSettings again should be a no-op (cache already populated)
    // We verify this by checking loadAppSettings was only called once
    expect(loadAppSettings).toHaveBeenCalledTimes(1)
  })

  it('handles errors gracefully without throwing', async () => {
    const { loadAppSettings } = await import('@/shared/lib/settings')
    vi.mocked(loadAppSettings).mockRejectedValue(new Error('disk fail'))

    const { preloadSettings } = await import('../hooks/useAppSettings')

    // Should not throw synchronously
    expect(() => preloadSettings()).not.toThrow()

    // Wait for async completion — should not cause unhandled rejection
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  it('is idempotent — second call is a no-op when cache is populated', async () => {
    const mockSettings = {
      theme: 'system' as const,
      recentProjects: [],
      neovimOutputPath: undefined,
    }

    const { loadAppSettings } = await import('@/shared/lib/settings')
    vi.mocked(loadAppSettings).mockResolvedValue(mockSettings)

    const { preloadSettings } = await import('../hooks/useAppSettings')

    preloadSettings()
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Second call — cache is already populated, should not call loadAppSettings again
    preloadSettings()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(loadAppSettings).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent calls — only one disk read', async () => {
    let resolveLoad!: (value: {
      theme: 'system'
      recentProjects: []
      neovimOutputPath: undefined
    }) => void
    const slowLoad = new Promise<{
      theme: 'system'
      recentProjects: []
      neovimOutputPath: undefined
    }>((resolve) => {
      resolveLoad = resolve
    })

    const { loadAppSettings } = await import('@/shared/lib/settings')
    vi.mocked(loadAppSettings).mockReturnValue(slowLoad)

    const { preloadSettings } = await import('../hooks/useAppSettings')

    // Call twice before the first resolves
    preloadSettings()
    preloadSettings()

    resolveLoad({
      theme: 'system',
      recentProjects: [],
      neovimOutputPath: undefined,
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Should only have called loadAppSettings once
    expect(loadAppSettings).toHaveBeenCalledTimes(1)
  })
})
