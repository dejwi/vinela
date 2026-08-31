import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/hooks/use-theme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}))

// The packaged app's CSP grants no 'wasm-unsafe-eval', so shiki's default WASM
// regex engine cannot compile there and highlighting silently degraded to plain
// text. Own file: shiki must not have been loaded before WebAssembly is removed.
describe('useLuaPreview without WebAssembly', () => {
  it('still highlights Lua', async () => {
    Object.defineProperty(globalThis, 'WebAssembly', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const { useLuaPreview } = await import('../useLuaPreview')
    const { result } = renderHook(() => useLuaPreview({ code: 'local x = 1' }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.html).toContain('color:')
  })
})
