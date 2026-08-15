import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// We test the HTTP layer in memory mode (no Tauri), so isMemoryMode() returns true
// and the implementation uses the global fetch().

// Mock the storage module so isMemoryMode() always returns true in tests
vi.mock('../storage', () => ({
  isMemoryMode: () => true,
}))

// Import after mocking
const { fetchJson, fetchText } = await import('../http')

// Helper to create a mock Response
function mockResponse(
  status: number,
  body: string,
  statusText = 'OK',
): Response {
  return new Response(body, {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns { success: true, data } on 200 with valid JSON', async () => {
    const payload = { name: 'telescope.nvim', stars: 16400 }
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, JSON.stringify(payload)),
    )

    const result = await fetchJson<typeof payload>(
      'https://api.github.com/repos/nvim-telescope/telescope.nvim',
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(payload)
    }
  })

  it('returns { success: false, error } on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchJson('https://api.github.com/repos/test/test')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Network error')
    }
  })

  it('returns { success: false, error } on non-200 status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(404, '{"message":"Not Found"}', 'Not Found'),
    )

    const result = await fetchJson(
      'https://api.github.com/repos/test/nonexistent',
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('404')
    }
  })

  it('returns { success: false, error } on 403 rate limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, '{"message":"rate limit exceeded"}', 'Forbidden'),
    )

    const result = await fetchJson('https://api.github.com/repos/test/test')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('403')
    }
  })

  it('returns { success: false, error } on invalid JSON response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, 'this is not json'),
    )

    const result = await fetchJson('https://api.github.com/repos/test/test')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('JSON')
    }
  })

  it('returns { success: false, error } on 500 server error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(
        500,
        '{"message":"Internal Server Error"}',
        'Internal Server Error',
      ),
    )

    const result = await fetchJson('https://api.github.com/repos/test/test')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('500')
    }
  })
})

describe('fetchText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns { success: true, data } on 200', async () => {
    const content = '{"id":"my-plugin","pluginName":"My Plugin"}'
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(content, { status: 200 }),
    )

    const result = await fetchText(
      'https://raw.githubusercontent.com/test/test/main/vinela.schema.json',
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(content)
    }
  })

  it('returns { success: false, error } on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(404, 'Not Found', 'Not Found'),
    )

    const result = await fetchText(
      'https://raw.githubusercontent.com/test/test/main/vinela.schema.json',
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('404')
    }
  })

  it('returns { success: false, error } on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await fetchText(
      'https://raw.githubusercontent.com/test/test/main/file.json',
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to fetch')
    }
  })
})
