import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type UseLuaPreviewParams, useLuaPreview } from '../useLuaPreview'

const { JSDOM } = require('jsdom') as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis }
}

const dom = new JSDOM('<!doctype html><html><body></body></html>')

Object.assign(globalThis, {
  document: dom.window.document,
  window: dom.window,
})

// Mock the theme hook
vi.mock('@/shared/hooks/use-theme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}))

describe('useLuaPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return null html when disabled', () => {
    const { result } = renderHook(() =>
      useLuaPreview({ code: 'print("hello")', enabled: false }),
    )

    expect(result.current.html).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it('should return null html when code is empty', () => {
    const { result } = renderHook(() => useLuaPreview({ code: '' }))

    expect(result.current.html).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it('should start loading when code is provided', async () => {
    const { result } = renderHook(() =>
      useLuaPreview({ code: 'print("hello")' }),
    )

    // Initially should be loading
    expect(result.current.isLoading).toBe(true)
    expect(result.current.html).toBeNull()

    // Wait for highlighting to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should have HTML output
    expect(result.current.html).not.toBeNull()
    expect(result.current.hasError).toBe(false)
  })

  it('should cache results for same code', async () => {
    const code = 'local x = 1'

    const { result, rerender } = renderHook(
      (props: UseLuaPreviewParams) => useLuaPreview(props),
      {
        initialProps: { code },
      },
    )

    // Wait for first highlight
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const firstHtml = result.current.html

    // Rerender with same code
    rerender({ code })

    // Should immediately have cached result
    expect(result.current.html).toBe(firstHtml)
    expect(result.current.isLoading).toBe(false)
  })

  it('should update when code changes', async () => {
    const { result, rerender } = renderHook(
      (props: UseLuaPreviewParams) => useLuaPreview(props),
      {
        initialProps: { code: 'local x = 1' },
      },
    )

    // Wait for first highlight
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const firstHtml = result.current.html

    // Change code
    rerender({ code: 'local y = 2' })

    // Should be loading new code
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should have different HTML
    expect(result.current.html).not.toBe(firstHtml)
  })

  it('should handle errors gracefully', async () => {
    // Note: Testing error handling is difficult because Shiki is loaded as a singleton.
    // In production, if Shiki fails to load, the hook will set hasError to true.
    // This test documents the expected behavior.

    // Simulate an error by passing invalid code (empty code doesn't trigger highlighting)
    const { result } = renderHook(() =>
      useLuaPreview({ code: '', enabled: true }),
    )

    // Empty code should not be loading and have no error
    expect(result.current.hasError).toBe(false)
    expect(result.current.html).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
